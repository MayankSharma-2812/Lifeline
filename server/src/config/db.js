const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  await mongoose.connect(uri);
  // eslint-disable-next-line no-console
  console.log("[mongo] connected:", mongoose.connection.host);
}

module.exports = { connectDB };
