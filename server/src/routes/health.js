/**
 * @file health.js
 * @description Health monitoring routes for L4/L7 Load Balancers and Container Orchestrators (Kubernetes / ECS).
 *
 * Concepts demonstrated in this file:
 * - Health Probes (Liveness & Readiness): Differentiating process liveness from dependency readiness
 * - High Availability & Fault Detection: Load balancers remove unhealthy backend instances from routing pools
 * - HTTP Status Codes used correctly: 200 OK vs 503 Service Unavailable
 */
const { Router } = require('express');
const mongoose = require('mongoose');
const { getRedis } = require('../config/redis');

const router = Router();

/**
 * Liveness Probe: Verifies that the Node.js event loop is running.
 * Used by container orchestrators to detect process deadlocks or fatal hangs.
 */
router.get('/live', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    pid: process.pid,
  });
});

/**
 * Readiness Probe: Verifies that the server and its database dependencies
 * are ready to receive and process user traffic.
 */
router.get('/ready', async (_req, res) => {
  const checks = {
    server: 'up',
    mongo: 'down',
    redis: 'down',
  };

  let isReady = true;

  // Check MongoDB connection state (1 = connected)
  if (mongoose.connection.readyState === 1) {
    checks.mongo = 'up';
  } else {
    isReady = false;
  }

  // Check Redis connectivity
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = 'up';
  } catch (err) {
    checks.redis = `down (${err.message})`;
    isReady = false;
  }

  const statusCode = isReady ? 200 : 503;
  res.status(statusCode).json({
    status: isReady ? 'ready' : 'degraded',
    statusCode,
    checks,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
