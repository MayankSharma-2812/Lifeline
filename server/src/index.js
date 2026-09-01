/**
 * @file index.js
 * @description Application entry point. Initializes database connections, sets up the HTTP server, and mounts the WebSocket instance for LifeLine.
 */
require("dotenv").config();
const app = require("./app");
const { connectDB } = require("./config/db");
const { connectRedis } = require("./config/redis");
const { createServer } = require("http");
const { initSocket } = require("./socket");

const mongoose = require("mongoose");

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  await connectRedis();

  const httpServer = createServer(app);
  initSocket(httpServer);

  const server = httpServer.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] running on port ${PORT}`);
  });

  // Concept: Graceful Shutdown (System Design) — drain in-flight requests and close DB connections
  function gracefulShutdown(signal) {
    // eslint-disable-next-line no-console
    console.log(`[server] ${signal} signal received. Closing HTTP server and draining connections...`);
    
    server.close(async () => {
      // eslint-disable-next-line no-console
      console.log('[server] HTTP server closed. Disconnecting databases...');
      try {
        await mongoose.connection.close(false);
        // eslint-disable-next-line no-console
        console.log('[server] MongoDB connection closed cleanly.');
        process.exit(0);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[server] Error during database disconnect:', err);
        process.exit(1);
      }
    });

    // Force close if graceful shutdown hangs for >10s
    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error('[server] Forced shutdown after 10s timeout.');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[server] startup failed:", err);
  process.exit(1);
});
