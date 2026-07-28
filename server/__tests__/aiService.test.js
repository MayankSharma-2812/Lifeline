const { parseEmergencyTextFallback } = require('../src/services/aiService');

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
