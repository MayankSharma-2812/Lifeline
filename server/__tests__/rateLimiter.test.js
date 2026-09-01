/**
 * @file rateLimiter.test.js
 * @description Unit tests for sliding window rate limiter middleware.
 */
const express = require('express');
const request = require('supertest');
const { createRateLimiter } = require('../src/middleware/rateLimiter');

describe('Rate Limiter Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    const limiter = createRateLimiter({ windowMs: 1000, max: 2, prefix: 'test' });
    app.get('/test', limiter, (_req, res) => res.json({ success: true }));
  });

  it('should allow requests within limit', async () => {
    const res1 = await request(app).get('/test');
    expect(res1.status).toBe(200);
    expect(res1.headers['x-ratelimit-remaining']).toBeDefined();

    const res2 = await request(app).get('/test');
    expect(res2.status).toBe(200);
  });

  it('should block requests exceeding max threshold with 429', async () => {
    await request(app).get('/test');
    await request(app).get('/test');

    const res3 = await request(app).get('/test');
    expect(res3.status).toBe(429);
    expect(res3.body.error).toMatch(/Too many requests/);
    expect(res3.headers['retry-after']).toBeDefined();
  });
});
