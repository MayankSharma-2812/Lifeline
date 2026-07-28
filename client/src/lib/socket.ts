import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

/**
 * Lazy Socket.io singleton — created on first call to getSocket().
 * Auth token is attached via socket.auth before connecting; the server's
 * JWT middleware reads it from socket.handshake.auth.token.
 */
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      withCredentials: true,
      autoConnect: false,
      auth: { token: getAccessToken() ?? '' },
    });

    // Re-attach the current access token on every reconnect attempt
    // (the token may have been silently refreshed since the last connection).
    socket.on('connect_error', (err) => {
      if (err.message === 'Invalid or expired access token') {
        // Token expired mid-session — the 401 interceptor in api.ts will
        // refresh it; update socket auth and let socket.io retry.
        socket!.auth = { token: getAccessToken() ?? '' };
      }
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  s.auth = { token: getAccessToken() ?? '' };
  if (!s.connected) s.connect();
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/** Join the Socket.io room for a specific request — receives all status events. */
export function joinRequestRoom(requestId: string) {
  getSocket().emit('join:request', requestId);
}
