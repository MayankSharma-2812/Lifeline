import { useEffect, useState } from 'react';
import { getSocket, joinRequestRoom } from '../lib/socket';

export type RequestStatus =
  | 'pending'
  | 'matched'
  | 'reserved'
  | 'confirmed'
  | 'escalated'
  | 'expired'
  | 'cancelled';

export interface StatusPayload {
  donorProfileId?: string;
  expiresInSeconds?: number;
  candidates?: unknown[];
  [key: string]: unknown;
}

export interface StatusEvent {
  status: RequestStatus;
  payload: StatusPayload;
}

const STATUS_EVENTS: RequestStatus[] = [
  'matched',
  'reserved',
  'confirmed',
  'escalated',
  'expired',
];

/**
 * useRequestStatus — subscribes to real-time status events for a given request.
 *
 * Joins the Socket.io room `request:{requestId}` and listens for all status
 * transition events. Returns the latest { status, payload } so the UI can
 * update the stepper and countdown without polling.
 *
 * @param requestId  The EmergencyRequest _id. Pass null when no request is active.
 */
export function useRequestStatus(requestId: string | null) {
  const [statusEvent, setStatusEvent] = useState<StatusEvent | null>(null);

  useEffect(() => {
    if (!requestId) return;

    const socket = getSocket();
    joinRequestRoom(requestId);

    const handlers = STATUS_EVENTS.map((event) => {
      const handler = (payload: StatusPayload) => {
        setStatusEvent({ status: event, payload });
      };
      socket.on(event, handler);
      return { event, handler };
    });

    return () => {
      handlers.forEach(({ event, handler }) => socket.off(event, handler));
    };
  }, [requestId]);

  return statusEvent;
}
