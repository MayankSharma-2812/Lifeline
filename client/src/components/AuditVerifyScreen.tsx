import React from 'react';
import { Candidate, EmergencyRequest } from '../types';

interface AuditVerifyScreenProps {
  requestId: string;
  parsed: EmergencyRequest['parsed'];
  selectedCandidate?: Candidate | null;
  onBack: () => void;
}

export const AuditVerifyScreen: React.FC<AuditVerifyScreenProps> = ({
  requestId,
  parsed,
  selectedCandidate,
  onBack,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-on-background border border-outline-variant dark:border-outline rounded-xl p-6 shadow-sm flex justify-between items-center">
        <div>
          <span className="font-label-caps text-xs text-secondary uppercase tracking-widest block mb-1">
            Verification & Audit Trail
          </span>
          <h2 className="font-headline-lg text-xl text-on-surface">
            REQ-{requestId.slice(-8).toUpperCase()}
          </h2>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant rounded-lg text-xs font-semibold text-on-surface transition-colors"
        >
          Back
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Parsed Intake Details */}
        <div className="bg-white dark:bg-on-background border border-outline-variant rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <span className="material-symbols-outlined text-xl">auto_awesome</span>
            <h3>OpenRouter AI Intake Parser</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/60">
              <span className="text-secondary">Extracted Blood Group:</span>
              <strong className="text-primary font-mono">{parsed.bloodGroup}</strong>
            </div>
            <div className="flex justify-between p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/60">
              <span className="text-secondary">Assigned Urgency:</span>
              <strong className="capitalize font-mono">{parsed.urgency}</strong>
            </div>
            <div className="flex justify-between p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/60">
              <span className="text-secondary">Parser Source:</span>
              <strong className="font-mono">{parsed.source || 'ai'}</strong>
            </div>
          </div>
        </div>

        {/* Selected Candidate Audit */}
        <div className="bg-white dark:bg-on-background border border-outline-variant rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <span className="material-symbols-outlined text-xl">lock</span>
            <h3>Redis Lock Concurrency State</h3>
          </div>
          {selectedCandidate ? (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/60">
                <span className="text-secondary">Donor Name:</span>
                <strong>{selectedCandidate.name}</strong>
              </div>
              <div className="flex justify-between p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/60">
                <span className="text-secondary">Distance:</span>
                <strong className="font-mono">{(selectedCandidate.distanceMetres / 1000).toFixed(1)} km</strong>
              </div>
              <div className="flex justify-between p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/60">
                <span className="text-secondary">Reliability Score:</span>
                <strong className="font-mono">{selectedCandidate.reliabilityScore} / 100</strong>
              </div>
              <div className="p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/60 font-mono text-[11px] break-all">
                Lock Key: <span className="text-primary">lock:donor:{selectedCandidate.donorProfileId}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-secondary">No candidate selected for reservation yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};
