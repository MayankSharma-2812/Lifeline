const { Router } = require("express");
const router = Router();

// Stub — implemented in Phase 2
router.post("/:id/availability", (_req, res) => res.status(501).json({ error: "not implemented" }));

module.exports = router;
