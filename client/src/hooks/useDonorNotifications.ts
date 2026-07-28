import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';

export interface IncomingReservation {
  requestId: string;
  donorProfileId: string;
  expiresInSeconds: number;
}

/**
 * useDonorNotifications — listens on the personal user room for incoming
 * reservation requests directed at this donor.
 *
 * The server emits 'reservation:incoming' to user:{donorUserId} when a
 * requester reserves this donor, so the donor dashboard shows the alert
 * immediately without the donor needing to know the requestId upfront.
 */
export function useDonorNotifications() {
  const [incoming, setIncoming] = useState<IncomingReservation | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const handler = (payload: IncomingReservation) => {
      setIncoming(payload);
    };

    socket.on('reservation:incoming', handler);
    return () => {
      socket.off('reservation:incoming', handler);
    };
  }, []);

  const dismiss = () => setIncoming(null);

  return { incoming, dismiss };
}
