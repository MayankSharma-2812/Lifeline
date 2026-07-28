const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true, // needed for httpOnly refresh-token cookie
  })
);
app.use(morgan("dev"));
app.use(express.json());

// ── Routes (stubs until Phase 1+) ──────────────────────────────
app.use("/api/v1/auth", require("./routes/auth"));
app.use("/api/v1/requests", require("./routes/requests"));
app.use("/api/v1/donors", require("./routes/donors"));

// ── Health check ────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Global error handler ────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

module.exports = app;
