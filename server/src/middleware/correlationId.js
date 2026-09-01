/**
 * @file correlationId.js
 * @description Distributed tracing middleware. Attaches a unique X-Request-ID header to every incoming HTTP request.
 *
 * Concepts demonstrated in this file:
 * - Distributed Tracing: End-to-end request correlation across microservices, reverse proxies, and audit logs
 * - Middleware: Express request enrichment middleware
 */
const crypto = require('crypto');

/**
 * Extracts an existing X-Request-ID from upstream reverse proxies (like Nginx/Cloudflare)
 * or generates a new cryptographic UUID v4.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware.
 */
function correlationIdMiddleware(req, res, next) {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-ID', reqId);
  next();
}

module.exports = { correlationIdMiddleware };
