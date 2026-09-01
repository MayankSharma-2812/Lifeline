/**
 * @file health.test.js
 * @description Unit tests for health monitoring routes and correlation ID headers.
 */
const request = require('supertest');
const app = require('../src/app');

describe('Health Probes and Middleware', () => {
  it('GET /api/v1/health/live should return 200 with process info and X-Request-ID', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.pid).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /health should return health probe status', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
