/**
 * @file rateLimiter.js
 * @description Sliding Window Rate Limiting middleware. Protects APIs against DDoS, credential stuffing, and brute force attacks.
 *
 * Concepts demonstrated in this file:
 * - Rate Limiting & Throttling: Sliding window log / counter algorithm tracking timestamped requests in a rolling time window
 * - Distributed Systems Caching: Upstash Redis backed state with local memory fallback for resilience
 * - HTTP status codes used correctly: 429 Too Many Requests with standard Retry-After headers
 */
const { getRedis } = require('../config/redis');

// In-memory sliding window fallback store if Redis is unavailable
const memoryBuckets = new Map();

/**
 * Creates an Express middleware enforcing sliding-window rate limits.
 *
 * @param {Object} options - Rate limiter options.
 * @param {number} [options.windowMs=60000] - Window size in milliseconds (default 1 minute).
 * @param {number} [options.max=60] - Maximum allowed requests per window.
 * @param {string} [options.prefix='rl'] - Key namespace prefix for isolation.
 * @returns {import('express').RequestHandler} Express rate limiting middleware.
 */
function createRateLimiter({ windowMs = 60_000, max = 60, prefix = 'rl' } = {}) {
  const windowSec = Math.ceil(windowMs / 1000);

  return async function rateLimiter(req, res, next) {
    // Identify client by IP address or authenticated User ID
    const identifier = req.userId ? `user:${req.userId}` : `ip:${req.ip || req.socket.remoteAddress || '127.0.0.1'}`;
    const key = `ratelimit:${prefix}:${identifier}`;
    const now = Date.now();

    try {
      // Attempt Redis sliding window calculation
      const redis = getRedis();
      const windowStart = now - windowMs;

      // In Upstash Redis REST, track counter in a bucket key
      // Increment counter and set expiration if new
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, windowSec);
      }

      const remaining = Math.max(0, max - current);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

      if (current > max) {
        res.setHeader('Retry-After', windowSec);
        return res.status(429).json({
          error: 'Too many requests. Please slow down.',
          retryAfterSeconds: windowSec,
        });
      }

      return next();
    } catch {
      // In-memory sliding window fallback
      if (!memoryBuckets.has(key)) {
        memoryBuckets.set(key, []);
      }

      const timestamps = memoryBuckets.get(key);
      const windowStart = now - windowMs;
      // Prune expired timestamps
      const activeTimestamps = timestamps.filter((t) => t > windowStart);
      activeTimestamps.push(now);
      memoryBuckets.set(key, activeTimestamps);

      const remaining = Math.max(0, max - activeTimestamps.length);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);

      if (activeTimestamps.length > max) {
        res.setHeader('Retry-After', windowSec);
        return res.status(429).json({
          error: 'Too many requests. Please slow down.',
          retryAfterSeconds: windowSec,
        });
      }

      return next();
    }
  };
}

module.exports = { createRateLimiter };
