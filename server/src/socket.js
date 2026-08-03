/**
 * @file socket.js
 * @description WebSocket configuration using Socket.io. Handles real-time events for reservations, confirmations, and session management.
 */
const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');

let io;

const { corsOriginHandler } = require('./utils/corsOrigin');

/**
 * Initializes the Socket.io server and attaches it to the provided HTTP server.
 * Sets up authentication middleware and room-joining logic.
 *
 * @param {import('http').Server} httpServer - The Node.js HTTP server instance.
 * @returns {Server} The configured Socket.io Server instance.
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: corsOriginHandler,
      credentials: true,
    },
  });

  // Auth middleware: verify access token on every connection
  // Client must pass { auth: { token: accessToken } } when creating the socket.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid or expired access token'));
    }
  });

  io.on('connection', (socket) => {
    // Every authenticated user auto-joins their personal room.
    // Used for: session-revoked events, incoming reservation notifications.
    socket.join(`user:${socket.userId}`);

    // Requester/donor join a request room to get status updates.
    socket.on('join:request', (requestId) => {
      socket.join(`request:${requestId}`);
    });

    // Donor explicitly joins their donor room (redundant with user room,
    // kept for clarity if donor-specific events are added later).
    socket.on('join:donor', (donorProfileId) => {
      socket.join(`donor:${donorProfileId}`);
    });

    socket.on('disconnect', () => {
      // Rooms cleaned up automatically by socket.io
    });
  });

  // eslint-disable-next-line no-console
  console.log('[socket.io] initialised');
  return io;
}

// Emit helpers (used by reservation / auth services)

/**
 * Broadcasts a status event to all clients in a specific request's room.
 *
 * @param {string} requestId - The ID of the emergency request.
 * @param {string} event - The event name to emit.
 * @param {Object} [payload={}] - The event data payload.
 */
function emitSocketEvent(requestId, event, payload = {}) {
  if (!io) return; // no-op in unit tests
  io.to(`request:${requestId}`).emit(event, payload);
}

/**
 * Sends an event to a specific user's personal room.
 * Used for session-revoked and incoming reservation notifications.
 *
 * @param {string} userId - The user ID to target.
 * @param {string} event - The event name to emit.
 * @param {Object} [payload={}] - The event data payload.
 */
function emitToUser(userId, event, payload = {}) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

/**
 * Retrieves the currently initialized Socket.io Server instance.
 *
 * @returns {Server} The Socket.io Server instance.
 */
function getIO() {
  return io;
}

module.exports = { initSocket, emitSocketEvent, emitToUser, getIO };
