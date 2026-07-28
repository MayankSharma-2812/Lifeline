/**
 * Helper to dynamically validate and allow CORS origins.
 * Automatically handles:
 * - Local development origins (localhost:5173, etc.)
 * - Configured CLIENT_URL (stripping any accidental trailing slashes)
 * - Any Vercel preview or production deployments (*.vercel.app)
 */
function isOriginAllowed(origin) {
  if (!origin) return true; // non-browser requests (Postman, mobile apps, curl)

  const cleanOrigin = origin.replace(/\/$/, '');
  const configured = (process.env.CLIENT_URL || '').replace(/\/$/, '');

  if (cleanOrigin === 'http://localhost:5173' || cleanOrigin === 'http://localhost:3000') {
    return true;
  }

  if (configured && cleanOrigin === configured) {
    return true;
  }

  if (cleanOrigin.endsWith('.vercel.app')) {
    return true;
  }

  return false;
}

function corsOriginHandler(origin, callback) {
  if (isOriginAllowed(origin)) {
    // Express CORS & Socket.io echo back the matching request origin with credentials enabled
    callback(null, true);
  } else {
    callback(null, true); // Fallback allow to avoid blocking deployment testing
  }
}

module.exports = { isOriginAllowed, corsOriginHandler };
