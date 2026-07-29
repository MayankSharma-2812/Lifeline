import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, MapPin, ShieldCheck, Lock, Sparkles, SearchX, Award, RotateCcw } from 'lucide-react';
import { Candidate, EmergencyRequest } from '../types';
import { reserveDonorApi } from '../lib/api';

interface MatchingDonorScreenProps {
  requestId: string;
  parsed: EmergencyRequest['parsed'];
  candidates: Candidate[];
  onDonorReserved: (donorProfileId: string, lockKey: string) => void;
  onNewRequest: () => void;
}

export const MatchingDonorScreen: React.FC<MatchingDonorScreenProps> = ({
  requestId,
  parsed,
  candidates,
  onDonorReserved,
  onNewRequest,
}) => {
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReserve = async (donorProfileId: string) => {
    setError(null);
    setReservingId(donorProfileId);

    try {
      const res = await reserveDonorApi(requestId, donorProfileId);
      onDonorReserved(donorProfileId, res.lockKey);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          'Failed to reserve donor. They may have been reserved by another request.'
      );
    } finally {
      setReservingId(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header Intake Summary Banner */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-6 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-[6px] border-l-primary-container shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-white font-bold text-2xl shadow">
            {parsed.bloodGroup || '??'}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-label-caps text-xs text-secondary uppercase tracking-widest">
                REQ-{requestId.slice(-6).toUpperCase()}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-1 ${
                  parsed.urgency === 'critical'
                    ? 'bg-error-container text-on-error-container'
                    : parsed.urgency === 'high'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {parsed.urgency} Urgency
              </span>
              {parsed.source && (
                <span className="px-2 py-0.5 rounded bg-surface-container-high text-xs font-semibold text-secondary">
                  Source: {parsed.source}
                </span>
              )}
            </div>
            <h2 className="font-headline-lg text-lg md:text-headline-md text-on-surface">
              Hyperlocal Donor Match Pipeline
            </h2>
          </div>
        </div>

        <button
          onClick={onNewRequest}
          className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant rounded-lg text-xs font-semibold text-on-surface transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>New Search</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-error-container text-on-error-container rounded-xl flex items-center gap-3 font-semibold text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Candidate List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-md text-base text-on-surface">
            Ranked Compatible Donors ({candidates.length})
          </h3>
          <span className="text-xs text-secondary">Sorted by distance & reliability</span>
        </div>

        {candidates.length === 0 ? (
          /* Minimal single-color empty-state matching crimson accent per spec */
          <div className="p-12 text-center bg-white dark:bg-on-background rounded-xl border border-outline-variant space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary-container/10 flex items-center justify-center mx-auto text-primary">
              <SearchX className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-on-surface text-base">No Available Donors Found</h4>
            <p className="text-xs text-secondary max-w-md mx-auto leading-relaxed">
              No donors matching compatible blood groups within 50 km are currently available.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="sync">
              {candidates.map((c, index) => {
                const km = (c.distanceMetres / 1000).toFixed(1);
                const isReserving = reservingId === c.donorProfileId;
                const isTopMatch = index === 0;

                return (
                  <motion.div
                    key={c.donorProfileId}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.25, delay: index * 0.04 }}
                    className={`bg-white dark:bg-on-background border rounded-xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 relative ${
                      isTopMatch
                        ? 'border-primary/50 ring-1 ring-primary/20 bg-surface-container-lowest dark:bg-on-background'
                        : 'border-outline-variant dark:border-outline'
                    }`}
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center font-bold text-primary text-lg border border-outline-variant">
                          {c.bloodGroup}
                        </div>
                        <span className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-primary-container text-white text-[10px] font-bold flex items-center justify-center">
                          #{index + 1}
                        </span>
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h4 className="font-bold text-base text-on-surface">{c.name}</h4>
                          {isTopMatch && (
                            <span className="px-2 py-0.5 bg-primary-container/10 text-primary border border-primary/20 rounded text-[11px] font-bold flex items-center gap-1">
                              <Award className="w-3 h-3" />
                              Top Match
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded text-xs font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Available
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-secondary flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-secondary" />
                            {km} km away
                          </span>
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Reliability: <strong className="text-on-surface">{c.reliabilityScore} pts</strong>
                          </span>
                        </div>

                        {c.explanation && (
                          <p className="text-xs text-secondary bg-surface-container-low p-2.5 rounded-lg border border-outline-variant/60 flex items-start gap-2 mt-2">
                            <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                            <span>{c.explanation}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Reserve Action Button */}
                    <div className="flex flex-col items-end gap-2 justify-center">
                      <button
                        onClick={() => handleReserve(c.donorProfileId)}
                        disabled={isReserving}
                        className="w-full md:w-auto px-6 py-3 bg-primary-container hover:bg-primary text-white font-semibold rounded-xl shadow transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                      >
                        {isReserving ? (
                          <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            <span>Reserve Donor</span>
                          </>
                        )}
                      </button>
                      <span className="text-[10px] text-secondary font-mono">
                        Redis SET NX • 15 min lock
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
