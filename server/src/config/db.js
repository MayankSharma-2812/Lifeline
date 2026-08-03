/**
 * @file db.js
 * @description MongoDB connection configuration. Manages the connection to the primary document database used by LifeLine.
 */
const mongoose = require("mongoose");

/**
 * Initializes the MongoDB connection using the connection string from environment variables.
 * @returns {Promise<void>} Resolves when the connection is successfully established.
 * @throws {Error} If the MONGODB_URI environment variable is missing.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  await mongoose.connect(uri);
  // eslint-disable-next-line no-console
  console.log("[mongo] connected:", mongoose.connection.host);
}

module.exports = { connectDB };
