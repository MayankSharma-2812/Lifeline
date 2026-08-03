/**
 * @module socket.ts
 * @description Manages the global Socket.io client instance for real-time bidirectional communication.
 */
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

/**
 * Lazy Socket.io singleton configuration. Created only on the first call to getSocket().
 * Includes automatic attachment of JWT authorization via socket headers.
 */
let socket: Socket | null = null;

/**
 * Retrieves or instantiates the global Socket.io connection.
 *
 * @returns The initialized socket instance.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      withCredentials: true,
      autoConnect: false,
      auth: { token: getAccessToken() ?? '' },
    });

    // Handle token expiration events that occur during active web socket connections.
    socket.on('connect_error', (err) => {
      if (err.message === 'Invalid or expired access token') {
        // Apply the new JWT and let Socket.io execute its internal retry logic.
        socket!.auth = { token: getAccessToken() ?? '' };
      }
    });
  }
  return socket;
}

/**
 * Forces a connection for the primary singleton instance.
 */
export function connectSocket() {
  const s = getSocket();
  s.auth = { token: getAccessToken() ?? '' };
  if (!s.connected) s.connect();
}

/**
 * Gracefully shuts down the global socket connection and cleans up local references.
 */
export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/**
 * Joins a specialized room designated for tracking an individual emergency request.
 *
 * @param requestId - The targeted request ID to subscribe to.
 */
export function joinRequestRoom(requestId: string) {
  getSocket().emit('join:request', requestId);
}
