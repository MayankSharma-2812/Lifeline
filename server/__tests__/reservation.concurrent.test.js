/**
 * Redis NX Lock — Concurrency Test
 *
 * This is the headline system-design proof: fire N simultaneous SET NX requests
 * at the same Redis key and assert EXACTLY ONE succeeds.
 *
 * Why this works:
 *   Redis is single-threaded for command execution. Even when N requests arrive
 *   at nearly the same time, Redis processes them serially. Only the first SET NX
 *   to be processed returns 'OK'; every subsequent one for the same key returns
 *   null (key already exists). This is guaranteed by the Redis specification —
 *   no application-level mutex or transaction needed.
 *
 * Per LLD §4 and HLD §3.3.
 */

require('dotenv').config(); // load UPSTASH_ env vars
const { Redis } = require('@upstash/redis');

const CONCURRENCY = 20; // number of simultaneous reservation attempts
const LOCK_TTL_MS = 30_000; // 30 s — short so test cleanup is fast

const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const describeFn = hasRedis ? describe : describe.skip;

describeFn('Redis SET NX — distributed lock concurrency guarantee', () => {
  let redis;

  beforeAll(() => {
    if (!hasRedis) return;
    redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  });

  test(
    `exactly 1 of ${CONCURRENCY} concurrent SET NX calls acquires the lock`,
    async () => {
      // Unique key per test run so parallel CI jobs don't collide
      const lockKey = `test:lock:donor:concurrent:${Date.now()}`;

      let results;
      try {
        // Fire all N requests simultaneously — Promise.all does NOT await each one
        // sequentially; it races them. Redis still processes them one at a time
        // internally, so exactly one 'OK' can come back.
        results = await Promise.all(
          Array.from({ length: CONCURRENCY }, (_, i) =>
            redis.set(lockKey, `request-${i}`, { nx: true, px: LOCK_TTL_MS })
          )
        );
      } finally {
        // Always clean up — don't leave test keys in Upstash
        await redis.del(`test:lock:donor:concurrent:${Date.now() - 1}`).catch(() => {});
        // The real key from this test run:
        await redis.del(lockKey).catch(() => {});
      }

      const successes = results.filter((r) => r === 'OK');
      const failures  = results.filter((r) => r === null);

      // ── The assertion that proves no double-booking is possible ──
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(CONCURRENCY - 1);
    },
    30_000 // 30 s timeout — Upstash REST has network latency
  );

  test('lock is released when key is deleted (simulating confirm/decline)', async () => {
    const lockKey = `test:lock:donor:release:${Date.now()}`;

    // Acquire
    const first = await redis.set(lockKey, 'req-1', { nx: true, px: LOCK_TTL_MS });
    expect(first).toBe('OK');

    // A second attempt while held should fail
    const second = await redis.set(lockKey, 'req-2', { nx: true, px: LOCK_TTL_MS });
    expect(second).toBeNull();

    // Release (simulate confirm or decline)
    await redis.del(lockKey);

    // After release, a new request can acquire the lock
    const third = await redis.set(lockKey, 'req-3', { nx: true, px: LOCK_TTL_MS });
    expect(third).toBe('OK');

    await redis.del(lockKey); // cleanup
  }, 30_000);
});
