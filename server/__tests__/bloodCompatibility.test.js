const { isCompatible } = require("../src/utils/bloodCompatibility");

describe("isCompatible — blood-group donor→recipient table", () => {
  // Universal donor
  test("O- donates to all groups", () => {
    const all = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];
    all.forEach((g) => expect(isCompatible("O-", g)).toBe(true));
  });

  // Universal recipient
  test("AB+ receives from all groups", () => {
    const all = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];
    all.forEach((g) => expect(isCompatible(g, "AB+")).toBe(true));
  });

  // Same-type always compatible
  test("same blood group is always compatible", () => {
    const all = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];
    all.forEach((g) => expect(isCompatible(g, g)).toBe(true));
  });

  // Spot-checks for incompatible pairs
  test("A+ cannot donate to O+", () => expect(isCompatible("A+", "O+")).toBe(false));
  test("B+ cannot donate to A+", () => expect(isCompatible("B+", "A+")).toBe(false));
  test("AB+ cannot donate to O-", () => expect(isCompatible("AB+", "O-")).toBe(false));
  test("AB- cannot donate to B+", () => expect(isCompatible("AB-", "B+")).toBe(false));

  // Negative matches
  test("O+ cannot donate to O-", () => expect(isCompatible("O+", "O-")).toBe(false));
  test("A- can donate to A+", ()  => expect(isCompatible("A-", "A+")).toBe(true));
  test("B- can donate to AB+", () => expect(isCompatible("B-", "AB+")).toBe(true));

  // Invalid group
  test("unknown donor group returns false", () => {
    expect(isCompatible("X+", "O+")).toBe(false);
  });
});
