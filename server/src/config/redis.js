const { Redis } = require('@upstash/redis');

/**
 * Upstash Redis REST client — HTTP-based, no persistent TCP connection needed.
 * @upstash/redis auto-serialises/deserialises values as JSON, so we store
 * plain objects and get plain objects back (no manual JSON.parse/stringify).
 */
let client;

async function connectRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('UPSTASH_REDIS_REST_URL / TOKEN not set');

  client = new Redis({ url, token });

  // Smoke-test the connection
  await client.ping();
  // eslint-disable-next-line no-console
  console.log('[redis] Upstash connected');
}

function getRedis() {
  if (!client) throw new Error('Redis not initialised — call connectRedis() first');
  return client;
}

module.exports = { connectRedis, getRedis };
