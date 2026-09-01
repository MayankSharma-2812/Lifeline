/**
 * @file app.js
 * @description Express application setup. Configures middleware, security headers, routing, and global error handling for the LifeLine API.
 *
 * Concepts demonstrated in this file:
 * - Middleware: Express application pipeline with helmet, cors, morgan, express.json, and cookie-parser
 * - Server-side error handling: Centralized global Express error handler catching status codes and formatting JSON errors
 * - RESTful endpoint design: Root API route registration under /api/v1/ prefix
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { correlationIdMiddleware } = require('./middleware/correlationId');
const { createRateLimiter } = require('./middleware/rateLimiter');

const app = express();

// Concept: Distributed Tracing — attach unique X-Request-ID early in the middleware pipeline
app.use(correlationIdMiddleware);

// Concept: Middleware — security headers middleware
app.use(helmet());
const { corsOriginHandler } = require('./utils/corsOrigin');

// Concept: Middleware — CORS validation and cookie credential support
app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true, // required for httpOnly refresh-token cookie
  })
);
app.use(morgan('dev'));
// Concept: Middleware — JSON body parsing and Cookie parsing
app.use(express.json());
app.use(cookieParser());

// Concept: Rate Limiting & Throttling (System Design)
// General API rate limiter (120 requests per minute per IP/user)
const generalLimiter = createRateLimiter({ windowMs: 60_000, max: 120, prefix: 'api' });
// Sensitive auth rate limiter (20 requests per minute to prevent brute-forcing)
const authLimiter = createRateLimiter({ windowMs: 60_000, max: 20, prefix: 'auth' });

// ── Routes ──────────────────────────────────────────────────────
// Concept: RESTful endpoint design — versioned resource route mounting
app.use('/api/v1/auth',     authLimiter, require('./routes/auth'));
app.use('/api/v1/requests', generalLimiter, require('./routes/requests'));
app.use('/api/v1/donors',   generalLimiter, require('./routes/donors'));

// ── Health Probes & Load Balancer Monitoring ────────────────────
// Concept: Health Probes (Liveness & Readiness) for L4/L7 Load Balancers
app.use('/api/v1/health', require('./routes/health'));
app.use('/health', require('./routes/health'));

// ── Global error handler ────────────────────────────────────────
// Concept: Server-side error handling — catch-all Express error handling middleware with correlation ID
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    requestId: req?.id,
  });
});

module.exports = app;
