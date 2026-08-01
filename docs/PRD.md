# LifeLine — Product Requirements Document (PRD)

## 1. Problem Statement
In medical emergencies (accident trauma, surgery, dialysis, thalassemia, dengue-driven platelet crashes), families and hospitals in India currently locate blood donors through **manual phone calls and WhatsApp broadcast groups**. This is slow, unverifiable, and has no way to prevent two people racing to claim the same donor at the same time.

## 2. Goal
Build a hyperlocal network where a **Requester** describes an emergency in plain language, gets matched instantly to the nearest eligible **Donor**, reserves that match with a guarantee no one else can claim it simultaneously, and gets auto-escalated to the next candidate if there's no response — with an AI layer handling intake parsing and match explainability.

## 3. Target Users
| User | Need |
|---|---|
| Requester | Fast, trustworthy donor discovery in a moment of panic |
| Donor | Simple availability management, notified only when genuinely matched |

## 4. Core User Stories
1. As a Requester, I can type "Need O+ blood, father in ICU at Fortis Jaipur, urgent" and the system extracts blood group, urgency, and location without a form.
2. As a Requester, I get a ranked list of nearest eligible donors with an AI-generated one-line explanation of each ranking.
3. As a Requester, I can **reserve** a donor; that donor is locked for a fixed window so no other requester can claim them concurrently.
4. As a Donor, if I don't respond within the window, the system auto-escalates to the next-nearest donor and releases my lock.
5. As any user, I see real-time status changes (matched → reserved → confirmed/expired) without refreshing.
6. As a user, I can log in/out securely, and revoke my own sessions from other devices if needed.

## 5. MVP Scope (1 week, solo build)
**In scope:** Blood-donor matching only. Auth (signup/login, access + refresh tokens, Redis-backed sessions). AI intake parsing + match explanation. Redis-based atomic reservation locking. Real-time status via Socket.io. Simplified escalation (manual "simulate no-response" trigger rather than a background scheduler). Polyglot persistence (MongoDB geospatial matching + PostgreSQL Prisma audit trails).

**Explicitly out of scope for MVP, documented as Future Work:** Pharmacy/medicine inventory matching, SMS/push notification escalation, payments, ambulance/logistics routing, native mobile app, multi-region scaling, reliability-score nuance beyond a basic counter.

## 6. Success Metrics (for demo/viva)
- Time from request submission to top match shown: under 3 seconds (excluding AI call latency).
- Zero double-bookings under concurrent reservation load test — the headline system-design proof.
- Escalation correctly reassigns after a simulated non-response.
- A session revoked from one device is immediately dead on all others.

## 7. Tech Constraint & Polyglot Persistence
MERN (MongoDB, Express, React, Node.js) with plain React + Vite + React Router DOM for the frontend, Redis for sessions and distributed locking, OpenRouter for the AI layer, and PostgreSQL (via Prisma ORM) alongside MongoDB for relational audit trails and reporting JOINs (deliberate polyglot persistence).

## 8. Why This Isn't "Just Another CRUD App"
- Polyglot database architecture (MongoDB geospatial matching + PostgreSQL relational audit JOINs).
- Redis-based distributed reservation locking (`SET NX PX`), race-condition-safe under concurrent load.
- Priority-ranked, auto-escalating matching flow, not a static list.
- Proper auth: short-lived JWT access tokens + Redis-backed refresh sessions with instant revocation — not just "a JWT that lasts forever."
- AI used for intake parsing and explainability with a deterministic fallback — never the sole source of correctness.
