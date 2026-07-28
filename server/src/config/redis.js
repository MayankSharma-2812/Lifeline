const Redis = require("ioredis");

/** Singleton client — imported everywhere that needs Redis */
let client;

async function connectRedis() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL not set");

  client = new Redis(url, {
    // ioredis will auto-reconnect; log connection events
    lazyConnect: true,
  });

  client.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[redis] error:", err.message);
  });

  await client.connect();
  // eslint-disable-next-line no-console
  console.log("[redis] connected");
}

function getRedis() {
  if (!client) throw new Error("Redis not initialised — call connectRedis() first");
  return client;
}

module.exports = { connectRedis, getRedis };
