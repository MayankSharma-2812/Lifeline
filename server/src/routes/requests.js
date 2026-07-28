const { Router } = require("express");
const router = Router();

// Stubs — implemented in Phase 2/3
router.post("/",                (_req, res) => res.status(501).json({ error: "not implemented" }));
router.get("/:id/matches",      (_req, res) => res.status(501).json({ error: "not implemented" }));
router.post("/:id/reserve",     (_req, res) => res.status(501).json({ error: "not implemented" }));
router.post("/:id/confirm",     (_req, res) => res.status(501).json({ error: "not implemented" }));
router.post("/:id/decline",     (_req, res) => res.status(501).json({ error: "not implemented" }));

module.exports = router;
