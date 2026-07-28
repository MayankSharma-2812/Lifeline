const { Router }  = require('express');
const { authenticate } = require('../middleware/auth');
const DonorProfile = require('../models/DonorProfile');

const router = Router();

// ── POST /api/v1/donors/:id/availability ────────────────────────
// Toggle a donor's availability. :id is the DonorProfile _id.
// Only the donor who owns the profile can toggle it.
router.post('/:id/availability', authenticate, async (req, res, next) => {
  try {
    const profile = await DonorProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Donor profile not found' });

    // Ensure the requesting user owns this profile
    if (profile.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Don't allow toggling while reserved — that would break the lock
    if (profile.status === 'reserved') {
      return res.status(409).json({ error: 'Cannot change availability while reserved' });
    }

    const newStatus = profile.status === 'available' ? 'on_cooldown' : 'available';
    const newIsAvailable = newStatus === 'available';

    profile.status      = newStatus;
    profile.isAvailable = newIsAvailable;
    await profile.save();

    res.json({ donorProfileId: profile._id, status: profile.status, isAvailable: profile.isAvailable });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/donors/me ────────────────────────────────────────
// Return the current user's DonorProfile (used by the donor dashboard)
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const profile = await DonorProfile.findOne({ userId: req.userId });
    if (!profile) return res.status(404).json({ error: 'No donor profile found' });
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
