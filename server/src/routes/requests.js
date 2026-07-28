const { Router }                 = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate }           = require('../middleware/auth');
const EmergencyRequest           = require('../models/EmergencyRequest');
const { parseEmergencyText, explainMatch } = require('../services/aiService');
const { runMatchingForRequest }  = require('../services/matchingService');
const {
  reserveDonor,
  confirmReservation,
  declineAndEscalate,
}                                = require('../services/reservationService');

const router = Router();
router.use(authenticate);

// ── POST /api/v1/requests ────────────────────────────────────────
router.post(
  '/',
  [
    body('rawText').trim().notEmpty().withMessage('rawText is required'),
    body('location.lat').isFloat({ min: -90,  max: 90  }).withMessage('Valid latitude required'),
    body('location.lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { rawText, location } = req.body;
      const parsed = await parseEmergencyText(rawText);

      const emergencyRequest = await EmergencyRequest.create({
        requesterId: req.userId,
        rawText,
        parsed,
        location: { type: 'Point', coordinates: [location.lng, location.lat] },
        status: 'pending',
      });

      const { candidates } = await runMatchingForRequest(emergencyRequest._id);

      const withExplanations = await Promise.all(
        candidates.map(async (c) => ({
          ...c,
          explanation: await explainMatch(c, parsed.bloodGroup),
        }))
      );

      res.status(201).json({
        requestId: emergencyRequest._id,
        parsed,
        candidates: withExplanations,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/requests/:id/matches ────────────────────────────
router.get('/:id/matches', async (req, res, next) => {
  try {
    const { candidates, request } = await runMatchingForRequest(req.params.id);
    const parsed = request.parsed;

    const withExplanations = await Promise.all(
      candidates.map(async (c) => ({
        ...c,
        explanation: await explainMatch(c, parsed.bloodGroup),
      }))
    );

    res.json({
      requestId: request._id,
      status: request.status,
      parsed,
      candidates: withExplanations,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/requests/:id/reserve ───────────────────────────
// Requester reserves a specific donor — acquires the Redis NX lock.
router.post(
  '/:id/reserve',
  [body('donorProfileId').notEmpty().withMessage('donorProfileId required')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const result = await reserveDonor(
        req.params.id,
        req.body.donorProfileId,
        req.userId
      );
      res.json({ message: 'Donor reserved', ...result });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/v1/requests/:id/confirm ───────────────────────────
// Donor confirms the reservation — releases lock, marks confirmed.
router.post(
  '/:id/confirm',
  [body('donorProfileId').notEmpty().withMessage('donorProfileId required')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      await confirmReservation(req.params.id, req.body.donorProfileId, req.userId);
      res.json({ message: 'Reservation confirmed' });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/v1/requests/:id/decline ───────────────────────────
// Donor declines OR requester simulates no-response → triggers escalation.
router.post(
  '/:id/decline',
  [
    body('donorProfileId').notEmpty().withMessage('donorProfileId required'),
    body('outcome')
      .optional()
      .isIn(['declined', 'no_response'])
      .withMessage('outcome must be declined or no_response'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { donorProfileId, outcome = 'declined' } = req.body;
      const result = await declineAndEscalate(
        req.params.id,
        donorProfileId,
        outcome,
        req.userId
      );
      res.json({
        message:       `Escalated — outcome: ${outcome}`,
        nextCandidate: result.nextCandidate,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
