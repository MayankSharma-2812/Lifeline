const { Router } = require("express");
const router = Router();

// Stubs — implemented in Phase 1
router.post("/signup", (_req, res) => res.status(501).json({ error: "not implemented" }));
router.post("/login",  (_req, res) => res.status(501).json({ error: "not implemented" }));
router.post("/refresh",(_req, res) => res.status(501).json({ error: "not implemented" }));
router.post("/logout", (_req, res) => res.status(501).json({ error: "not implemented" }));

module.exports = router;
