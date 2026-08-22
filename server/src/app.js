/**
 * @file app.js
 * @description Express application setup. Configures middleware, security headers, routing, and global error handling for the LifeLine API.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const app = express();

app.use(helmet());
const { corsOriginHandler } = require('./utils/corsOrigin');

app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true, // required for httpOnly refresh-token cookie
  })
);
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// ── Routes ──────────────────────────────────────────────────────
app.use('/api/v1/auth',     require('./routes/auth'));
app.use('/api/v1/requests', require('./routes/requests'));
app.use('/api/v1/donors',   require('./routes/donors'));

// ── Health check ────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));

// ── Global error handler ────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
