require("dotenv").config();
const app = require("./app");
const { connectDB } = require("./config/db");
const { connectRedis } = require("./config/redis");
const { createServer } = require("http");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  await connectRedis();

  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] running on port ${PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[server] startup failed:", err);
  process.exit(1);
});
