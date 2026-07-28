import { useEffect, useRef } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { getAccessToken } from '../lib/api';

/**
 * useSocket — manages the Socket.io connection lifecycle.
 *
 * Call this once at the app level (e.g. inside a layout component that renders
 * after the user has logged in). Passes the current access token as socket auth
 * so the server's JWT middleware can verify the connection.
 *
 * Cleans up the socket on unmount (logout / navigate away from protected area).
 */
export function useSocket() {
  const connected = useRef(false);

  useEffect(() => {
    if (connected.current) return;

    const socket = getSocket();
    // Attach auth token — must be set before connecting
    socket.auth = { token: getAccessToken() ?? '' };
    connectSocket();
    connected.current = true;

    return () => {
      disconnectSocket();
      connected.current = false;
    };
  }, []);
}
