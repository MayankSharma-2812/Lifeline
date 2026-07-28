const { Router }                 = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate }           = require('../middleware/auth');
const EmergencyRequest           = require('../models/EmergencyRequest');
const DonorProfile               = require('../models/DonorProfile');
const { parseEmergencyText, explainMatch } = require('../services/aiService');
const { runMatchingForRequest }  = require('../services/matchingService');

const router = Router();

// All request routes require authentication
router.use(authenticate);

// ── POST /api/v1/requests ────────────────────────────────────────
// Submit a free-text emergency → AI parse → run matching → return candidates
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

      // 1. Parse text (AI → deterministic fallback)
      const parsed = await parseEmergencyText(rawText);

      // 2. Create the request document
      const emergencyRequest = await EmergencyRequest.create({
        requesterId: req.userId,
        rawText,
        parsed,
        location: {
          type:        'Point',
          coordinates: [location.lng, location.lat],
        },
        status: 'pending',
      });

      // 3. Run matching — updates request to 'matched' and stores candidateIds
      const { candidates } = await runMatchingForRequest(emergencyRequest._id);

      // 4. Attach AI explanations to each candidate
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
// Return the stored matches for a request (re-run matching to get fresh data)
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
      status:    request.status,
      parsed,
      candidates: withExplanations,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/requests/:id/reserve ───────────────────────────
// Implemented in Phase 3 (Redis lock acquisition)
router.post('/:id/reserve',  (_req, res) => res.status(501).json({ error: 'Phase 3' }));

// ── POST /api/v1/requests/:id/confirm ───────────────────────────
// Implemented in Phase 3
router.post('/:id/confirm',  (_req, res) => res.status(501).json({ error: 'Phase 3' }));

// ── POST /api/v1/requests/:id/decline ───────────────────────────
// Implemented in Phase 3
router.post('/:id/decline',  (_req, res) => res.status(501).json({ error: 'Phase 3' }));

module.exports = router;
