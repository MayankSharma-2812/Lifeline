/**
 * aiService — OpenRouter wrapper + deterministic fallback.
 *
 * Phase 2: deterministic fallback only (regex/keyword extraction).
 * Phase 5: OpenRouter call added as the primary path; this fallback
 *           activates whenever the AI call fails or times out.
 *
 * Per HLD §3.5: "AI is advisory, never authoritative, over the core matching decision."
 */

const BLOOD_GROUPS = ['AB+', 'AB-', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-'];

// ── Deterministic fallback ───────────────────────────────────────

/**
 * Extract {bloodGroup, urgency} from free text using keyword/regex matching.
 * Order matters: try longer tokens first to avoid 'B' matching before 'AB'.
 */
function parseEmergencyTextFallback(rawText) {
  const upper = rawText.toUpperCase();

  // Blood group — try each token in order (AB+/AB- before A/B to avoid partial match)
  const bloodGroup = BLOOD_GROUPS.find((g) => upper.includes(g)) ?? null;

  // Urgency — keyword ladder
  let urgency = 'moderate';
  if (/CRITICAL|ICU|LIFE[- ]THREAT|IMMEDIATE|CRASH|EMERGENCY/.test(upper)) {
    urgency = 'critical';
  } else if (/URGENT|SOON|HOSPITAL|SURGERY|OPERATION|IMPORTANT/.test(upper)) {
    urgency = 'high';
  }

  return { bloodGroup, urgency };
}

// ── OpenRouter call (added Phase 5 — stub returns null to trigger fallback) ──

async function _callOpenRouter(_rawText) {
  // ponytail: Phase 5 replaces this stub with the real fetch() call per LLD §7
  return null;
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Parse a free-text emergency description into { bloodGroup, urgency }.
 * Tries OpenRouter first; falls back to deterministic extraction on any failure.
 */
async function parseEmergencyText(rawText) {
  try {
    const aiResult = await _callOpenRouter(rawText);
    if (aiResult?.bloodGroup) return aiResult;
  } catch {
    // intentional fall-through to deterministic fallback
  }
  return parseEmergencyTextFallback(rawText);
}

/**
 * Generate a one-line human-readable explanation for a donor match.
 * Phase 5 replaces the stub with a real OpenRouter call.
 * @param {{ name, distanceMetres, bloodGroup, reliabilityScore }} match
 * @param {string} recipientBloodGroup
 * @returns {Promise<string>}
 */
async function explainMatch(match, recipientBloodGroup) {
  // ponytail: Phase 5 adds OpenRouter call here; deterministic explanation for now
  const km = (match.distanceMetres / 1000).toFixed(1);
  return `${match.bloodGroup} donor, ${km} km away, reliability score ${match.reliabilityScore} — compatible with ${recipientBloodGroup}.`;
}

module.exports = { parseEmergencyText, explainMatch, parseEmergencyTextFallback };
