const dotenv = require("dotenv");
const http = require('http');
const express = require('express');
const cors = require('cors');
const connection = require('./config/db');
const User = require('./models/user');

dotenv.config();

const mongoURI = process.env.MONGO_URI;
connection(mongoURI);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// In-memory storage for active connections
const activeConnections = new Map();
const activeRooms = new Map();

// Update user status in the database
const updateUserStatus = async (email, status) => {
  try {
    await User.findOneAndUpdate(
      { email },
      { $set: { status, lastActive: new Date() } },
      { new: true }
    );
  } catch (error) {
    console.error('Error updating user status:', error);
  }
};

// Handle signaling data
app.post('/signal', async (req, res) => {
  const { type, roomId, data, email } = req.body;

  switch (type) {
    case 'offer':
    case 'answer':
    case 'candidate': {
      const peer = activeRooms.get(roomId)?.find((id) => id !== email);
      if (peer) {
        res.json({ success: true, target: peer });
      } else {
        res.status(404).json({ error: 'No peer available' });
      }
      break;
    }

    case 'disconnect': {
      activeConnections.delete(email);
      await updateUserStatus(email, 'offline');
      res.json({ success: true });
      break;
    }

    default:
      res.status(400).json({ error: 'Invalid signal type' });
  }
});

// Create a room and connect peers
app.post('/create-room', async (req, res) => {
  const { email } = req.body;

  activeConnections.set(email, 'isSearching');
  await updateUserStatus(email, 'isSearching');

  const availablePeer = Array.from(activeConnections.entries()).find(
    ([key, status]) => key !== email && status === 'isSearching'
  );

  if (availablePeer) {
    const [peerEmail] = availablePeer;
    const roomId = `${email}-${peerEmail}`;

    activeRooms.set(roomId, [email, peerEmail]);
    activeConnections.set(email, 'inCall');
    activeConnections.set(peerEmail, 'inCall');

    await updateUserStatus(email, 'inCall');
    await updateUserStatus(peerEmail, 'inCall');

    res.json({ success: true, roomId });
  } else {
    res.json({ success: false, message: 'No peers available' });
  }
});

// End a call
app.post('/end-call', async (req, res) => {
  const { roomId } = req.body;

  const users = activeRooms.get(roomId);
  if (users) {
    for (const user of users) {
      await updateUserStatus(user, 'online');
      activeConnections.set(user, 'online');
    }
    activeRooms.delete(roomId);
  }

  res.json({ success: true });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Signaling server running on http://localhost:${PORT}`);
});
