const { getCompatibleDonorGroups } = require('../src/services/matchingService');

describe('getCompatibleDonorGroups — inverse compatibility table', () => {
  test('O- can only receive from O-', () => {
    expect(getCompatibleDonorGroups('O-')).toEqual(['O-']);
  });

  test('AB+ can receive from all 8 groups (universal recipient)', () => {
    const groups = getCompatibleDonorGroups('AB+');
    expect(groups).toHaveLength(8);
    expect(groups).toEqual(
      expect.arrayContaining(['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'])
    );
  });

  test('O+ can receive from O- and O+', () => {
    const groups = getCompatibleDonorGroups('O+');
    expect(groups).toEqual(expect.arrayContaining(['O-', 'O+']));
    expect(groups).toHaveLength(2);
  });

  test('A+ can receive from O-, O+, A-, A+', () => {
    const groups = getCompatibleDonorGroups('A+');
    expect(groups).toHaveLength(4);
    expect(groups).toEqual(expect.arrayContaining(['O-', 'O+', 'A-', 'A+']));
  });

  test('B- can receive from O- and B-', () => {
    const groups = getCompatibleDonorGroups('B-');
    expect(groups).toHaveLength(2);
    expect(groups).toEqual(expect.arrayContaining(['O-', 'B-']));
  });

  test('AB- can receive from O-, A-, B-, AB-', () => {
    const groups = getCompatibleDonorGroups('AB-');
    expect(groups).toHaveLength(4);
    expect(groups).toEqual(expect.arrayContaining(['O-', 'A-', 'B-', 'AB-']));
  });

  test('unknown group returns empty array', () => {
    expect(getCompatibleDonorGroups('Z+')).toEqual([]);
  });

  // Cross-check: symmetry with isCompatible
  test('every group returned can donate to the recipient', () => {
    const { isCompatible } = require('../src/utils/bloodCompatibility');
    const recipient = 'B+';
    const donors = getCompatibleDonorGroups(recipient);
    donors.forEach((d) => expect(isCompatible(d, recipient)).toBe(true));
  });
});
