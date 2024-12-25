const mongoose = require('mongoose');

/**
 * Cached MongoDB connection instance
 */
let cachedDb = null;

/**
 * Connect to MongoDB Atlas
 * @param {string} uri - MongoDB connection URI
 * @returns {Promise} - Resolves when connected to the database
 */
const connection = async (uri) => {
  if (cachedDb) {
    // If there's already a cached connection, return it
    return cachedDb;
  }

  try {
    const options = {
      dbName: 'talkwithgirls',
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    const conn = await mongoose.connect(uri, options);
    console.log('MongoDB Atlas connected successfully!');
    cachedDb = conn; // Cache the connection instance
    return conn;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1); // Exit the process with failure code
  }
};

module.exports = connection;
