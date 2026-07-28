const User          = require('../models/User');
const DonorProfile  = require('../models/DonorProfile');
const EmergencyRequest = require('../models/EmergencyRequest');
const { COMPATIBILITY } = require('../utils/bloodCompatibility');

const MAX_RADIUS_METRES = 50_000; // 50 km
const MAX_RESULTS       = 10;

/**
 * Returns every donor blood group that can safely donate to `recipientGroup`.
 * Pure function — used by the aggregation filter and unit-tested directly.
 * @param {string} recipientGroup
 * @returns {string[]}
 */
function getCompatibleDonorGroups(recipientGroup) {
  return Object.entries(COMPATIBILITY)
    .filter(([, recipients]) => recipients.includes(recipientGroup))
    .map(([donorGroup]) => donorGroup);
}

/**
 * Core matching query — per HLD §3.2.
 *
 * Runs a MongoDB $geoNear on the User collection (which holds the 2dsphere index),
 * $lookups the DonorProfile, then filters by:
 *   - compatible blood group
 *   - status === 'available'
 * and sorts by distance ASC, reliabilityScore DESC.
 *
 * @param {{ type: string, coordinates: number[] }} location  GeoJSON Point {[lng, lat]}
 * @param {string} bloodGroup   The recipient's required blood group
 * @param {number} [maxDistance]
 * @returns {Promise<Array>}    Array of match objects ready to return to the client
 */
async function findCandidates(location, bloodGroup, maxDistance = MAX_RADIUS_METRES) {
  const compatibleGroups = getCompatibleDonorGroups(bloodGroup);

  if (!compatibleGroups.length) return [];

  const results = await User.aggregate([
    // Step 1: geospatial sort — nearest donors first
    {
      $geoNear: {
        near:          location,           // { type: 'Point', coordinates: [lng, lat] }
        distanceField: 'distanceMetres',
        maxDistance:   maxDistance,
        spherical:     true,
        query:         { role: 'donor' },  // only users who are donors
      },
    },
    // Step 2: join DonorProfile
    {
      $lookup: {
        from:         'donorprofiles',
        localField:   '_id',
        foreignField: 'userId',
        as:           'profile',
      },
    },
    { $unwind: '$profile' },
    // Step 3: filter by availability + blood compatibility
    {
      $match: {
        'profile.status':     'available',
        'profile.bloodGroup': { $in: compatibleGroups },
      },
    },
    // Step 4: secondary sort — closer first; among equals, higher reliability first
    { $sort: { distanceMetres: 1, 'profile.reliabilityScore': -1 } },
    { $limit: MAX_RESULTS },
    // Step 5: project only the fields the client needs
    {
      $project: {
        _id:             0,
        donorProfileId:  '$profile._id',
        userId:          '$_id',
        name:            1,
        distanceMetres:  1,
        bloodGroup:      '$profile.bloodGroup',
        reliabilityScore:'$profile.reliabilityScore',
        status:          '$profile.status',
      },
    },
  ]);

  return results;
}

/**
 * Run matching for a given EmergencyRequest and persist the candidate list.
 * Updates the request to status "matched" and stores matchedCandidateIds.
 * @param {string} requestId
 * @returns {Promise<{ request, candidates }>}
 */
async function runMatchingForRequest(requestId) {
  const request = await EmergencyRequest.findById(requestId);
  if (!request) throw Object.assign(new Error('Request not found'), { status: 404 });

  const bloodGroup = request.parsed?.bloodGroup;
  if (!bloodGroup) throw Object.assign(new Error('Blood group not parsed from request'), { status: 422 });

  const candidates = await findCandidates(request.location, bloodGroup);

  const newStatus = candidates.length > 0 ? 'matched' : 'expired';
  request.matchedCandidateIds = candidates.map((c) => c.donorProfileId);
  request.status = newStatus;
  await request.save();

  return { request, candidates };
}

module.exports = { findCandidates, getCompatibleDonorGroups, runMatchingForRequest };
