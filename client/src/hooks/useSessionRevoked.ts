/**
 * @module useSessionRevoked.ts
 * @description Hook that listens for remote session revocation events to force a client-side logout.
 */
import { useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';

/**
 * Listens for administrative session termination commands dispatched to the user's private room.
 *
 * Due to the stateless nature of JWTs, instant revocation is enforced via Redis-backed blocklisting
 * and real-time socket events. This hook fulfills the client-side responsibility by intercepting
 * the termination signal and executing a provided callback (e.g., redirecting to the login screen).
 *
 * @param onRevoked - Callback function executed immediately when a revocation event is received.
 */
export function useSessionRevoked(onRevoked: () => void) {
  // BUG-8 fix: Keep latest callback reference in a ref to avoid stale closures
  const callbackRef = useRef(onRevoked);
  callbackRef.current = onRevoked;

  useEffect(() => {
    const socket = getSocket();
    const handler = () => {
      callbackRef.current();
    };
    
    // Bind the session termination event
    socket.on('session-revoked', handler);
    
    return () => {
      // Clean up the listener when the component unmounts
      socket.off('session-revoked', handler);
    };
  }, []);
}
