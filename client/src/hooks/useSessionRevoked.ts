/**
 * @module useSessionRevoked.ts
 * @description Hook that listens for remote session revocation events to force a client-side logout.
 */
import { useEffect, useCallback } from 'react';
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
  // Memoize the callback to prevent unnecessary effect re-runs, ignoring external dependency changes.
  const stableCallback = useCallback(onRevoked, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const socket = getSocket();
    
    // Bind the session termination event
    socket.on('session-revoked', stableCallback);
    
    return () => {
      // Clean up the listener when the component unmounts
      socket.off('session-revoked', stableCallback);
    };
  }, [stableCallback]); // Depends on the stabilized reference
}
