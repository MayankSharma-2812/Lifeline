# LifeLine — Product Requirements Document (PRD)

> **Document Version:** 1.2.0  
> **Author:** Mayank Sharma  
> **Status:** Approved / Production-Ready  
> **Core Concept Demonstrated:** Problem Modeling

---

## 1. Problem Statement & Modeling

In medical emergencies (acute trauma, obstetric hemorrhages, emergent cardiac or orthopedic surgeries, oncology transfusions, and dengue-induced severe thrombocytopenia), locating eligible blood and platelet donors in Indian urban and semi-urban clusters relies on **unstructured WhatsApp broadcast groups, telephone trees, and manual NGO registries**.

This status-quo workflow introduces systemic failure modes:
1. **Critical Latency:** Manual broadcasts take 45–180 minutes to locate a willing donor, exceeding the golden hour for trauma care.
2. **Double-Booking Collisions:** Multiple families or hospital coordinators simultaneously reach out to and book the same donor, leading to false fulfillment and critical shortages.
3. **Low Verification & High Friction:** Unverified broadcast texts contain typos, ambiguous location names, and unverified blood groups.
4. **No Deterministic Escalation:** If a contacted donor is unavailable, the search resets manually from scratch.

### Formal Problem Modeling
LifeLine models emergency donor allocation as a **constrained real-time geospatial matching and distributed reservation problem**:
- Let $R$ be an incoming emergency request defined by location coordinates $(lat_R, lng_R)$, required blood group $B_R$, and urgency level $U_R \in \{\text{critical}, \text{high}, \text{moderate}\}$.
- Let $D = \{d_1, d_2, \dots, d_n\}$ be the set of registered donors where each donor has coordinates $(lat_{d}, lng_{d})$, blood group $B_d$, availability status $S_d \in \{\text{available}, \text{reserved}, \text{on\_cooldown}\}$, and historical reliability score $W_d \in [0, 100]$.
- Find the optimal ranked subset $D^* \subseteq D$ satisfying:
  1. **Biological Compatibility:** $\text{Compatible}(B_d, B_R) = \text{True}$.
  2. **Geodesic Proximity:** $\text{HaversineDistance}(R, d) \le 50\text{ km}$.
  3. **Availability:** $S_d = \text{available}$.
  4. **Ranking Objective:** Minimize distance while maximizing historical reliability score:
     $$\text{Rank}(d) = \alpha \cdot \text{Distance}(R, d) - \beta \cdot W_d$$

---

## 2. Product Goals & Core Objectives

1. **Sub-3-Second Discovery:** Given natural language input, parse emergency parameters and compute the top 10 ranked candidate donors in under 3 seconds.
2. **Zero Double-Booking Guarantee:** Provide atomic, distributed reservation locks with a 15-minute Time-To-Live (TTL) window, ensuring two requesters cannot reserve the same donor concurrently.
3. **Automated Escalation Workflow:** Seamlessly release locks and notify the next ranked candidate if a donor declines or the 15-minute response window lapses.
4. **Advisory AI with 100% Deterministic Fallback:** Integrate Large Language Models (OpenRouter / GPT-4o-mini) for intake parsing and match explanation, while backing every AI call with a deterministic regex and keyword fallback engine.
5. **Regulatory & Audit Transparency:** Maintain an immutable, polyglot audit ledger recording every lifecycle transition for clinical and compliance verification.

---

## 3. Target User Personas

| Persona | Role | Key Needs & Pain Points |
|---|---|---|
| **Emergency Requester** | Patient family member, triage nurse, or emergency coordinator | Needs zero-friction intake (natural language), instant nearest donor ranking, and unambiguous booking without phone tag. |
| **Voluntary Donor** | Registered verified blood donor | Needs control over availability toggles, notification only for genuinely compatible local emergencies, and protection from spam calls. |
| **System Auditor** | Hospital administrator / compliance officer | Needs an immutable, chronologically ordered timeline of request intake, lock allocation, and confirmation decisions. |

---

## 4. Blood Compatibility Matrix

LifeLine enforces strict biological compatibility rules based on standard transfusion medicine:

| Recipient ($B_R$) | Compatible Donor Blood Groups ($B_d$) |
|---|---|
| **O-** | O- (Universal red cell donor, only receives O-) |
| **O+** | O+, O- |
| **A-** | A-, O- |
| **A+** | A+, A-, O+, O- |
| **B-** | B-, O- |
| **B+** | B+, B-, O+, O- |
| **AB-** | AB-, A-, B-, O- |
| **AB+** | AB+, AB-, A+, A-, B+, B-, O+, O- (Universal recipient) |

---

## 5. Core User Stories & Functional Requirements

### 5.1 Authentication & Profile Lifecycle
- **US-1.1:** As a new user, I can register as a Requester or Donor with phone, email, password, and location. Donors must supply their verified blood group.
- **US-1.2:** As a user, I receive a short-lived (15 min) JWT access token and an HTTP-only secure cookie containing a Redis session ID.
- **US-1.3:** As a user, I can log out from my device, instantly invalidating the Redis session across all open browser sessions via WebSocket push.

### 5.2 Emergency Request Intake & AI Parsing
- **US-2.1:** As a Requester, I can submit an emergency via natural text (e.g., *"Father in ICU at SMS Hospital Jaipur, need O- blood immediately"*).
- **US-2.2:** The system extracts `{ bloodGroup, urgency, location }` via OpenRouter JSON schema mode, falling back to deterministic regex extraction if the LLM API times out (8s limit) or errors.

### 5.3 Geospatial Matching & Ranking
- **US-3.1:** The system queries MongoDB using a `$geoNear` 2dsphere aggregation pipeline within a 50 km radius.
- **US-3.2:** Matches are projected with geodesic distance in kilometers and an AI-generated natural language match explanation.

### 5.4 Atomic Reservation & Distributed Locking
- **US-4.1:** As a Requester, I can reserve an available donor. The backend acquires a Redis distributed lock (`SET lock:donor:<id> <requestId> NX PX 900000`).
- **US-4.2:** If another requester attempts to reserve the same donor within the 15-minute window, the system rejects the attempt with HTTP `409 Conflict`.
- **US-4.3:** As a Donor, I receive an instant WebSocket notification on my dashboard displaying the incoming emergency details.

### 5.5 Confirmation & Escalation State Machine
- **US-5.1:** If the donor confirms, the Redis lock is deleted, the donor status transitions to `on_cooldown`, their reliability score increases by +2, and the request status updates to `confirmed`.
- **US-5.2:** If the donor declines or times out, the lock is released, a -10 reliability penalty is applied for timeouts, and the system automatically matches the next candidate.

---

## 6. Non-Functional Requirements & Service Level Agreements (SLAs)

1. **Intake Latency:** Sub-100ms for deterministic parsing; sub-2000ms for OpenRouter LLM parsing.
2. **Matching Engine Latency:** Geospatial candidate ranking executed in under 50ms for collections up to 100,000 donor records using MongoDB 2dsphere indexing.
3. **Locking Reliability:** 100% serialization of concurrent reservation attempts (zero double bookings under high concurrency).
4. **High Availability:** System functions continuously even if third-party AI or secondary SQL audit stores experience partial outages.
5. **Security & Privacy:** Passwords hashed with bcrypt (cost factor 10); JWT access tokens signed with HMAC-SHA256; CORS strictly bounded to authorized frontend domains.

---

## 7. Scope Boundaries (MVP vs Future Work)

### In Scope for MVP
- MERN stack architecture with React Router v6 client-side SPA routing.
- Polyglot persistence: MongoDB Atlas for geospatial matching + PostgreSQL via Prisma ORM for relational audit logging.
- Upstash Redis for distributed locks and session invalidation.
- Real-time bidirectional WebSocket synchronization via Socket.io.
- OpenRouter LLM integration with deterministic regex fallback.

### Explicitly Out of Scope for MVP
- Direct SMS/Telephony gateway integration (Twilio / Exotel).
- Native iOS / Android mobile applications (PWA supported).
- Financial payments and transit logistics routing.

---

## 8. Concept Implementation & Traceability Matrix

| Rubric Concept | Primary Implementation File | Exact Code Element / Mechanism |
|---|---|---|
| **Problem modeling** | `docs/PRD.md` (§1 & §2) & `matchingService.js` | Constrained optimization model: $\text{Rank}(d) = \alpha \cdot \text{Distance} - \beta \cdot W_d$ |
| **System design basics: Integration** | `docs/HLD.md` (§2 & §3.4) | Polyglot architecture (MongoDB Atlas + PostgreSQL Neon + Upstash Redis REST + Socket.io) |
| **Middleware** | `server/src/middleware/auth.js` | Express route-level `authenticate` middleware validating Bearer JWT & setting `req.userId` |
| **Client-side routing** | `client/src/App.tsx` | React Router v6 `<Routes>`, `<Route path="/login"|"/intake"|"/matches"|"/dashboard">` and role guards |
| **JavaScript — Event loop** | `client/src/components/EmergencyFormScreen.tsx` | `Promise.resolve().then(...)` microtask validation vs `setTimeout(..., 0)` macrotask view switch |
| **JavaScript — Hoisting** | `server/src/services/authService.js` | Function declaration `async function _createSession(user)` hoisted to module scope |
| **React component composition** | `client/src/components/AuthScreen.tsx` | `AuthScreenProps { onSuccess }` contract with modular sub-components and isolated state |
| **State management with useState** | `client/src/components/AuthScreen.tsx` | Controlled input bindings (`identifier`, `password`, `isDonor`) and UI feedback (`loading`, `error`) |
| **CRUD operations (Mongo)** | `server/src/services/authService.js` | Registration pipeline: `User.findOne`, `User.create`, and `DonorProfile.create` |
| **Indexing for performance (Mongo)** | `server/src/models/User.js`, `EmergencyRequest.js` | 2dsphere spatial index on `location`, compound index `{ requestId: 1, timestamp: -1 }` |
| **Aggregation pipelines (Mongo)** | `server/src/services/matchingService.js` | 5-stage aggregation: `$geoNear` (50km) $\rightarrow$ `$lookup` $\rightarrow$ `$unwind` $\rightarrow$ `$match` $\rightarrow$ `$sort` |
| **Relational schema design (PK/FK)** | `server/prisma/schema.prisma` | 1:N FK relation between `AuditEvent` and `DonorReference` with `onDelete: SetNull` |
| **SQL JOINs** | `server/src/services/auditService.js` | SQL `LEFT JOIN` via `prisma.auditEvent.findMany({ include: { donor: true } })` |
| **Structured outputs** | `server/src/services/aiService.js` | `response_format: { type: 'json_object' }` with runtime schema whitelist verification |

