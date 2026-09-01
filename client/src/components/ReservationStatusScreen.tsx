/**
 * @module ReservationStatusScreen.tsx
 * @description Provides a real-time status dashboard for an active donor reservation lock.
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Clock, CheckCircle2, Lock, AlertTriangle, XCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useRequestStatus } from '../hooks/useRequestStatus';
import { confirmReservationApi, declineReservationApi } from '../lib/api';

export interface ReservationStatusScreenProps {
  requestId: string;
  donorProfileId: string;
  lockKey?: string;
  expiresInSeconds?: number;
  onDone: () => void;
}

/**
 * Tracks the active reservation lifecycle. Connects to the Socket.io room for live status events
 * and maintains a countdown timer corresponding to the Redis lock TTL.
 */
export const ReservationStatusScreen: React.FC<ReservationStatusScreenProps> = ({
  requestId,
  donorProfileId,
  lockKey,
  expiresInSeconds = 900,
  onDone,
}) => {
  // Subscribe to real-time status transitions for this request
  const statusEvent = useRequestStatus(requestId);
  const currentStatus = statusEvent?.status || 'reserved';

  // BUG-4 fix: Initialize countdown timer from prop and update from socket events
  const [secondsLeft, setSecondsLeft] = useState(expiresInSeconds);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync timer if socket event carries a new TTL or prop updates
  useEffect(() => {
    if (typeof statusEvent?.payload?.expiresInSeconds === 'number') {
      setSecondsLeft(statusEvent.payload.expiresInSeconds);
    } else if (expiresInSeconds) {
      setSecondsLeft(expiresInSeconds);
    }
  }, [statusEvent, expiresInSeconds]);

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  /** Formats raw seconds into MM:SS display format. */
  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  /** Initiates the final confirmation when a donor successfully arrives/donates. */
  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await confirmReservationApi(requestId, donorProfileId);
      setMessage('Donation confirmed successfully! Donor reliability updated +2.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to confirm reservation.');
    } finally {
      setLoading(false);
    }
  };

  /** Declines the current reservation, optionally triggering an automated fallback to the next candidate. */
  const handleDecline = async (outcome: 'declined' | 'no_response' = 'declined') => {
    setLoading(true);
    setError(null);
    try {
      const res = await declineReservationApi(requestId, donorProfileId, outcome);
      
      // Provide toast notification for automated fallback scenarios
      if (outcome === 'no_response' || res.nextCandidate) {
        toast.info('No response — matched with next nearest donor');
      }

      setMessage(
        res.nextCandidate
          ? `Escalated — Lock released. Next donor matching triggered.`
          : `Escalated — No further donors found.`
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to decline reservation.');
    } finally {
      setLoading(false);
    }
  };

  // Define the ordered steps for the visual state machine
  const steps = [
    { id: 'matched', label: 'Matched', icon: CheckCircle2 },
    { id: 'reserved', label: 'Reserved', icon: Lock },
    { id: 'confirmed', label: 'Confirmed', icon: ShieldCheck },
    { id: 'escalated', label: currentStatus === 'escalated' ? 'Escalated' : 'Complete', icon: AlertTriangle },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Main Reservation Card */}
      <div className="bg-white dark:bg-on-background border border-outline-variant dark:border-outline rounded-xl p-8 shadow-lg space-y-8 relative overflow-hidden">
        {/* Status Stepper with smooth motion state transitions */}
        <div className="border-b border-outline-variant pb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="font-label-caps text-xs text-secondary uppercase tracking-widest">
              Live State Machine
            </span>
            <span className="font-mono text-xs bg-surface-container-high px-2.5 py-1 rounded text-on-surface">
              {lockKey || `lock:donor:${donorProfileId}`}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
            {steps.map((step) => {
              const StepIcon = step.icon;
              const isActive =
                (step.id === 'matched' && ['matched', 'reserved', 'confirmed'].includes(currentStatus)) ||
                (step.id === 'reserved' && ['reserved', 'confirmed'].includes(currentStatus)) ||
                (step.id === 'confirmed' && currentStatus === 'confirmed') ||
                (step.id === 'escalated' && ['escalated', 'expired'].includes(currentStatus));

              const isCurrent =
                (step.id === 'reserved' && currentStatus === 'reserved') ||
                (step.id === 'confirmed' && currentStatus === 'confirmed') ||
                (step.id === 'escalated' && ['escalated', 'expired'].includes(currentStatus));

              return (
                <motion.div
                  key={step.id}
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.02 : 1,
                  }}
                  transition={{ duration: 0.25 }}
                  className={`p-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors relative ${
                    isCurrent
                      ? step.id === 'confirmed'
                        ? 'bg-emerald-600 text-white font-bold shadow'
                        : step.id === 'escalated'
                        ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-bold border border-rose-300'
                        : 'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 font-bold border border-amber-400'
                      : isActive
                      ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                      : 'bg-surface-container-low text-secondary'
                  }`}
                >
                  <StepIcon className="w-3.5 h-3.5" />
                  <span>{step.label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Big Countdown Display with ticking animation */}
        <div className="text-center py-6 bg-surface-container-low dark:bg-tertiary-container rounded-2xl border border-outline-variant p-6 relative overflow-hidden">
          <div className="flex items-center justify-center gap-2 mb-2 text-secondary">
            <Clock className="w-4 h-4 text-primary animate-pulse" />
            <span className="font-label-caps text-xs uppercase tracking-widest">
              Reservation Lock TTL Countdown
            </span>
          </div>

          {/* Visible tick-down visual state */}
          <div className="font-display-timer text-5xl md:text-6xl text-primary dark:text-primary-fixed-dim font-bold tracking-tight font-mono">
            <motion.span
              key={secondsLeft}
              initial={{ opacity: 0.8, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              className="inline-block"
            >
              {formatTimer(secondsLeft)}
            </motion.span>
          </div>

          <p className="text-xs text-secondary mt-3">
            Donor profile locked via Redis <code className="text-primary font-bold">SET NX PX</code>. No other requester can reserve this donor while active.
          </p>
        </div>

        {message && (
          <div className="p-4 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-3 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-error-container text-on-error-container rounded-xl flex items-center gap-3 font-semibold text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <button
            onClick={handleConfirm}
            disabled={loading || currentStatus === 'confirmed'}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 px-4 rounded-xl shadow transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm Donation Arrival</span>
          </button>

          <button
            onClick={() => handleDecline('declined')}
            disabled={loading || currentStatus === 'confirmed'}
            className="w-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <XCircle className="w-4 h-4 text-error" />
            <span>Decline / Escalate Match</span>
          </button>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={onDone}
            className="text-xs font-semibold text-secondary hover:text-primary underline transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
