/**
 * aiService tests
 *
 * - Unit tests for the deterministic fallback (no network, fast)
 * - Integration smoke-test for the live OpenRouter call (requires API key in .env)
 *
 * The live test is tagged so it can be skipped in CI if the key isn't present.
 */

require('dotenv').config();
const {
  parseEmergencyTextFallback,
  parseEmergencyText,
  explainMatch,
} = require('../src/services/aiService');

// ── Deterministic fallback — pure, no network ────────────────────

describe('parseEmergencyTextFallback — deterministic text parsing', () => {
  test('extracts O+ from standard text', () => {
    const r = parseEmergencyTextFallback('Need O+ blood urgently for my father');
    expect(r.bloodGroup).toBe('O+');
  });

  test('extracts AB- correctly (not confused with A- or B-)', () => {
    const r = parseEmergencyTextFallback('Patient needs AB- blood, critical');
    expect(r.bloodGroup).toBe('AB-');
  });

  test('detects critical urgency from ICU keyword', () => {
    const r = parseEmergencyTextFallback('Father in ICU, need B+ blood');
    expect(r.urgency).toBe('critical');
  });

  test('detects high urgency from SURGERY keyword', () => {
    const r = parseEmergencyTextFallback('Surgery tomorrow, need A+ blood');
    expect(r.urgency).toBe('high');
  });

  test('defaults to moderate urgency when no keywords match', () => {
    const r = parseEmergencyTextFallback('Looking for O- donor');
    expect(r.urgency).toBe('moderate');
  });

  test('returns null bloodGroup when no group found', () => {
    const r = parseEmergencyTextFallback('Need blood urgently');
    expect(r.bloodGroup).toBeNull();
  });
});

// ── Graceful fallback when AI is unavailable ─────────────────────

describe('parseEmergencyText — fallback on AI failure', () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  afterEach(() => {
    process.env.OPENROUTER_API_KEY = originalKey;
  });

  test('returns deterministic result with source:fallback when API key missing', async () => {
    process.env.OPENROUTER_API_KEY = '';
    const result = await parseEmergencyText('Need O+ blood, father in ICU');
    expect(result.source).toBe('fallback');
    expect(result.bloodGroup).toBe('O+');
    expect(result.urgency).toBe('critical');
  });
});

// ── Live OpenRouter smoke-test (skipped if key not present) ──────

const hasApiKey = !!process.env.OPENROUTER_API_KEY;

describe('OpenRouter live API — smoke test', () => {
  // Skip gracefully in CI environments without the key
  const testFn = hasApiKey ? test : test.skip;

  testFn(
    'parseEmergencyText returns valid bloodGroup + urgency for a clear prompt',
    async () => {
      const result = await parseEmergencyText(
        'Need O positive blood urgently. Father is in the ICU at Fortis Hospital Jaipur.'
      );
      expect(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']).toContain(result.bloodGroup);
      expect(['critical', 'high', 'moderate']).toContain(result.urgency);
    },
    20_000 // generous timeout for network call
  );

  testFn(
    'explainMatch returns a non-empty string explanation',
    async () => {
      const match = { bloodGroup: 'O-', distanceMetres: 2500, reliabilityScore: 92 };
      const explanation = await explainMatch(match, 'O+');
      expect(typeof explanation).toBe('string');
      expect(explanation.length).toBeGreaterThan(10);
    },
    20_000
  );
});
