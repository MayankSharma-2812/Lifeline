/**
 * @file bloodCompatibility.js
 * @description Utility for checking blood group compatibility between donors and recipients.
 */

/**
 * Blood-group compatibility: isCompatible(donorGroup, recipientGroup)
 *
 * Standard donor to recipient compatibility table.
 * Source: https://www.redcrossblood.org/donate-blood/blood-types.html
 *
 * O- is the universal donor (all recipients).
 * AB+ is the universal recipient (accepts all donors).
 */

/** @type {Record<string, string[]>} donor group mapped to list of groups it can donate to */
const COMPATIBILITY = {
  "O-":  ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "O+":  ["O+", "A+", "B+", "AB+"],
  "A-":  ["A-", "A+", "AB-", "AB+"],
  "A+":  ["A+", "AB+"],
  "B-":  ["B-", "B+", "AB-", "AB+"],
  "B+":  ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"],
};

/**
 * Returns true if a donor with `donorGroup` can donate to a recipient who needs `recipientGroup`.
 * @param {string} donorGroup
 * @param {string} recipientGroup
 * @returns {boolean}
 */
function isCompatible(donorGroup, recipientGroup) {
  const canDonateTo = COMPATIBILITY[donorGroup];
  if (!canDonateTo) return false;
  return canDonateTo.includes(recipientGroup);
}

module.exports = { isCompatible, COMPATIBILITY };
