# LifeLine — Implementation Plan (for Antigravity build, solo/1-week)

> **Commit rule for every phase below:** once a phase's work is working and tested, **commit and push before moving to the next phase.** Small, working commits per phase — not one giant commit at the end. This also gives you a clean commit history to point to in the viva as evidence of incremental, tested development.

## Phase 0 — Repo & Docs Setup
- Init MERN repo: `/client` (React + Vite + TS), `/server` (Express), `/docs` (all planning docs — see cleanup note at the bottom).
- `.env.example` with `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`.
- ESLint/Prettier, Jest set up.
- **Commit:** "chore: project scaffold + docs"

## Phase 1 — Auth (signup/login, access+refresh, Redis sessions)
- User schema, bcrypt password hashing.
- `/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout` per LLD §5.
- Redis session store wired up (Upstash free tier or local Redis for dev).
- **Commit:** "feat: auth with access/refresh tokens and Redis sessions"

## Phase 2 — Data Layer & Matching Engine
- DonorProfile, EmergencyRequest, AuditLog schemas + 2dsphere index.
- Blood-compatibility pure function + Jest unit tests.
- `$geoNear` aggregation for candidate donors, sorted by distance + reliability.
- **Commit:** "feat: donor matching engine with geospatial query"

## Phase 3 — Reservation & Escalation (core showcase)
- Redis `SET NX PX` locking endpoint per LLD §4.
- Concurrency test: fire N simultaneous reservation requests, assert exactly one succeeds.
- Manual "simulate no-response" trigger + real TTL expiry release.
- **Commit:** "feat: race-condition-safe reservation locking via Redis"

## Phase 4 — Real-time Layer
- Socket.io server, per-request rooms, events: `matched`, `reserved`, `confirmed`, `escalated`, `expired`, `session-revoked`.
- Client hook subscribing to room updates.
- **Commit:** "feat: real-time status updates via Socket.io"

## Phase 5 — AI Layer
- `aiService.js` OpenRouter wrapper: `parseEmergencyText`, `explainMatches`, both with deterministic fallback.
- **Commit:** "feat: AI intake parsing and match explanation via OpenRouter"

## Phase 6 — Frontend
- Auth screens, Intake → Confirm-parse → Matches → Reservation screens, Donor dashboard — built from the Stitch designs.
- Status stepper component driven by WebSocket state.
- **Commit:** "feat: frontend screens for requester and donor flows"

## Phase 7 — Hardening & Demo Prep
- Seed script generating realistic donors around a chosen city.
- Rehearse the demo script from `04_APP_FLOW.md` §4, including the double-reservation conflict and session-revocation moments.
- **Commit:** "chore: seed data and demo prep"

## Final Step — Docs Cleanup (do this last, right before submission)
Once the project is complete and the viva demo is rehearsed, **delete every planning doc except `PRD.md`, `HLD.md`, and `LLD.md`** from `/docs` — the Kalvium submission only requires these three. That means removing `04_APP_FLOW.md`, `05_UI_UX_BRIEF.md`, `06_STITCH_PROMPT.md`, and this file (`07_IMPLEMENTATION_PLAN.md`) from the repo before final submission. Keep them locally/off-repo for your own reference if you want, but the pushed repo's `/docs` folder should contain only the three mandatory documents.
- **Commit:** "docs: trim docs folder to PRD/HLD/LLD for submission"

## What to Rehearse for the Viva
1. Walk through the Redis-locked reservation code line-by-line — your strongest, most specific answer.
2. Explain why Redis-backed sessions beat a stateless-only JWT refresh (instant revocation).
3. Explain why AI is advisory, not authoritative, in the matching decision.
4. Be ready to draw the escalation state machine from memory.
