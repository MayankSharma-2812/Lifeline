# LifeLine — Master Project & System Design Learning Guide

Welcome to the comprehensive learning guide for **LifeLine** — an AI-powered, real-time emergency blood donor matching and dispatch platform built with **React (TypeScript), Node.js (Express), MongoDB Atlas, PostgreSQL (Neon / Prisma), Upstash Redis, Socket.io, and Nginx**.

This document is your single source of truth to understand every architectural decision, system design pattern, core coding concept, and viva defense explanation across the entire project.

---

## Table of Contents
1. [Project Mission & Problem Modeling](#1-project-mission--problem-modeling)
2. [High-Level Architecture & Multi-System Flow](#2-high-level-architecture--multi-system-flow)
3. [System Design Concepts Implemented](#3-system-design-concepts-implemented)
   - [A. Two-Tier Load Balancing & Horizontal Scaling](#a-two-tier-load-balancing--horizontal-scaling)
   - [B. Sliding Window Rate Limiting & Throttling](#b-sliding-window-rate-limiting--throttling)
   - [C. Circuit Breaker Resilience Pattern](#c-circuit-breaker-resilience-pattern)
   - [D. Polyglot Persistence Architecture](#d-polyglot-persistence-architecture)
   - [E. Distributed Concurrency Locking (Redis SET NX PX)](#e-distributed-concurrency-locking-redis-set-nx-px)
   - [F. Real-Time Bidirectional WebSockets](#f-real-time-bidirectional-websockets)
   - [G. Distributed Tracing & Correlation IDs](#g-distributed-tracing--correlation-ids)
   - [H. Health Probes (Liveness & Readiness) & Graceful Shutdown](#h-health-probes-liveness--readiness--graceful-shutdown)
4. [Core Software Engineering & JavaScript Concepts](#4-core-software-engineering--javascript-concepts)
   - [A. JavaScript Event Loop: Microtasks vs Macrotasks](#a-javascript-event-loop-microtasks-vs-macrotasks)
   - [B. JavaScript Function Declaration Hoisting](#b-javascript-function-declaration-hoisting)
   - [C. React Component Composition & State Isolation](#c-react-component-composition--state-isolation)
   - [D. Client-Side Routing & Role-Based Guards](#d-client-side-routing--role-based-guards)
5. [Viva Defense Master Cheat Sheet ("Say This:" Scripts)](#5-viva-defense-master-cheat-sheet-say-this-scripts)
6. [How to Run, Test, and Benchmark](#6-how-to-run-test-and-benchmark)

---

## 1. Project Mission & Problem Modeling

### The Core Problem
In critical medical emergencies (surgeries, trauma, accidents), the delay in finding compatible, nearby, and available blood donors leads to preventable mortality. Existing platforms suffer from:
1. **Unstructured Communication:** Requesters post frantic unstructured text on social media without blood group extraction or geographic coordinates.
2. **Double-Booking & Race Conditions:** Multiple emergency hospitals call the same nearby donor simultaneously.
3. **No Reliability Feedback:** Donors who ignore urgent alerts remain prioritized over responsive donors.

### Mathematical Problem Modeling
LifeLine models emergency dispatch as a **constrained multi-variable ranking optimization**:

$$\text{Rank}(d) = \alpha \cdot \text{Distance}(r, d) - \beta \cdot \text{ReliabilityScore}(d)$$

Subject to:
1. $\text{BloodGroup}(d) \in \text{CompatibleGroups}(\text{BloodGroup}(r))$
2. $\text{Distance}(r, d) \le 50\text{ km}$
3. $\text{Status}(d) = \text{'available'}$

Where:
- $\alpha = 1.0$ (distance penalty weight)
- $\beta = 0.5$ (reliability bonus weight)
- $\text{ReliabilityScore} \in [0, 100]$ (starts at 100; $+2$ on successful confirmation, $-10$ on non-response timeout)

---

## 2. High-Level Architecture & Multi-System Flow

```
                                    ┌────────────────────────┐
                                    │    Client (React SPA)  │
                                    └───────────┬────────────┘
                                                │ HTTP / WSS
                                                ▼
                                    ┌────────────────────────┐
                                    │ Nginx L7 Load Balancer │ (:80) (ip_hash sticky routing)
                                    └───────────┬────────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
        ┌─────────────────────────┐                           ┌─────────────────────────┐
        │ Node.js Cluster (Inst 1)│                           │ Node.js Cluster (Inst 2)│
        │ ├── Master Process      │                           │ ├── Master Process      │
        │ ├── Worker 1 (Core 1)   │                           │ ├── Worker 3 (Core 1)   │
        │ └── Worker 2 (Core 2)   │                           │ └── Worker 4 (Core 2)   │
        └────────────┬────────────┘                           └────────────┬────────────┘
                     │                                                     │
                     └──────────────────────────┬──────────────────────────┘
                                                │
        ┌───────────────────────┬───────────────┴───────────────┬───────────────────────┐
        ▼                       ▼                               ▼                       ▼
┌───────────────┐       ┌───────────────┐               ┌───────────────┐       ┌───────────────┐
│ MongoDB Atlas │       │ Upstash Redis │               │PostgreSQL Neon│       │  OpenRouter   │
│  (Geospatial  │       │  (Locks, TTL, │               │ (Prisma SQL   │       │ (LLM with     │
│   2dsphere)   │       │  Rate Limits) │               │  Audit Logs)  │       │CircuitBreaker)│
└───────────────┘       └───────────────┘               └───────────────┘       └───────────────┘
```

### End-to-End Request Journey:
1. **Intake:** Requester types natural language: *"Need O- blood urgently for surgery at Fortis Hospital Jaipur"*.
2. **AI Extraction & Circuit Breaker:** `aiService.js` routes text to OpenRouter LLM through a Circuit Breaker. If the AI is slow or down, it instantly falls back to deterministic regex extraction to produce `{ bloodGroup: 'O-', urgency: 'critical' }`.
3. **Geospatial Pipeline:** `matchingService.js` runs a 5-stage `$geoNear` aggregation on MongoDB to find compatible donors within 50 km, sorted by distance ASC and reliability DESC.
4. **Distributed Reservation Lock:** Requester reserves the top candidate. `reservationService.js` executes an atomic `SET lock:donor:<id> <reqId> NX PX 900000` in Redis (15-minute lock).
5. **Real-Time Notification:** Socket.io emits a `reservation:incoming` alert to the donor's private user room.
6. **Confirmation / Auto-Escalation:** If donor confirms, reliability increases $+2$, donor enters cooldown, and status becomes `confirmed`. If donor declines or times out (15m), lock is dropped, $-10$ penalty is applied if no response, and the system automatically matches the next nearest donor.
7. **Immutable Audit Trail:** `auditService.js` writes an auditable relational record to PostgreSQL via Prisma with foreign key constraints.

---

## 3. System Design Concepts Implemented

### A. Two-Tier Load Balancing & Horizontal Scaling
* **Files:** [`server/src/cluster.js`](file:///c:/Users/mayan/lifeline/server/src/cluster.js), [`nginx/nginx.conf`](file:///c:/Users/mayan/lifeline/nginx/nginx.conf), [`docker-compose.yml`](file:///c:/Users/mayan/lifeline/docker-compose.yml)
* **Mechanism:**
  1. **Layer 7 Nginx Reverse Proxy:** Uses `upstream lifeline_backend` with the `ip_hash` directive to enforce **Session Affinity (Sticky Sessions)**. This prevents WebSocket handshake failures during HTTP long-polling upgrade negotiations.
  2. **Multi-Core Process Cluster:** Node.js runs on a single thread. `cluster.js` uses Node's native `cluster` module to spawn one worker per CPU core (`cluster.fork()`) with round-robin scheduling (`cluster.schedulingPolicy = cluster.SCHED_RR`).
  3. **Fault Tolerance & Self-Healing:** The master process listens to `cluster.on('exit')`. If a worker dies due to an uncaught exception, the master automatically spawns a replacement worker with crash-loop throttling protection.

### B. Sliding Window Rate Limiting & Throttling
* **File:** [`server/src/middleware/rateLimiter.js`](file:///c:/Users/mayan/lifeline/server/src/middleware/rateLimiter.js)
* **Mechanism:** Uses Upstash Redis `incr` and `expire` with an in-memory timestamp sliding-window fallback.
  - General API: $120\text{ req/min}$
  - Sensitive Auth: $20\text{ req/min}$ (blocks brute force attacks)
  - Returns HTTP `429 Too Many Requests` with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After: <seconds>` headers.

### C. Circuit Breaker Resilience Pattern
* **Files:** [`server/src/utils/circuitBreaker.js`](file:///c:/Users/mayan/lifeline/server/src/utils/circuitBreaker.js), [`server/src/services/aiService.js`](file:///c:/Users/mayan/lifeline/server/src/services/aiService.js)
* **Mechanism:** 3-State Finite State Machine protecting external LLM dependencies:
  - **CLOSED:** Normal operation. Counts consecutive failures.
  - **OPEN:** After 3 consecutive network failures or HTTP 402/503 errors, the circuit trips to `OPEN`. All subsequent calls fail instantly (0ms) without hitting the network, routing immediately to the deterministic regex fallback.
  - **HALF_OPEN:** After a 30-second cooldown, 1 trial probe request is permitted. If it succeeds, the circuit resets to `CLOSED`. If it fails, it trips back to `OPEN` for another 30 seconds.

### D. Polyglot Persistence Architecture
* **Files:** [`server/src/models/`](file:///c:/Users/mayan/lifeline/server/src/models/), [`server/prisma/schema.prisma`](file:///c:/Users/mayan/lifeline/server/prisma/schema.prisma)
* **Mechanism:** Choosing the optimal database engine for each specific access pattern:
  - **MongoDB Atlas (Document + Geospatial):** Stores dynamic emergency requests and utilizes `2dsphere` spatial indexes for `$geoNear` radius queries.
  - **PostgreSQL Neon via Prisma (Relational ACID Audit):** Stores immutable compliance logs with foreign keys (`donorId` $\rightarrow$ `donors_reference.id`) and `LEFT JOIN` queries.
  - **Upstash Redis (In-Memory Key-Value):** Fast distributed locking (`SET NX PX`), session invalidation, and rate limiting counters.

### E. Distributed Concurrency Locking (Redis SET NX PX)
* **File:** [`server/src/services/reservationService.js`](file:///c:/Users/mayan/lifeline/server/src/services/reservationService.js)
* **Mechanism:** Atomically acquires locks with:
  ```js
  await redis.set(`lock:donor:${donorProfileId}`, requestId, { nx: true, px: 900000 });
  ```
  `nx: true` ensures that if two requesters attempt to reserve the same donor in the exact same millisecond, exactly one receives `'OK'`, while the other receives `null` and is rejected with `409 Conflict`. `px: 900000` guarantees auto-release after 15 minutes if a server crashes.

### F. Real-Time Bidirectional WebSockets
* **Files:** [`server/src/socket.js`](file:///c:/Users/mayan/lifeline/server/src/socket.js), [`client/src/hooks/useSocket.ts`](file:///c:/Users/mayan/lifeline/client/src/hooks/useSocket.ts)
* **Mechanism:** JWT authentication middleware on handshake (`io.use`). Auto-joins private user rooms (`user:<userId>`) and request rooms (`request:<requestId>`). Dispatches instant notifications on reservation, confirmation, escalation, and session revocation.

### G. Distributed Tracing & Correlation IDs
* **File:** [`server/src/middleware/correlationId.js`](file:///c:/Users/mayan/lifeline/server/src/middleware/correlationId.js)
* **Mechanism:** Extracts `X-Request-ID` from upstream Nginx proxies or generates a `crypto.randomUUID()`. Attaches `req.id` to every log entry, audit event, and error response for end-to-end distributed traceability.

### H. Health Probes (Liveness & Readiness) & Graceful Shutdown
* **Files:** [`server/src/routes/health.js`](file:///c:/Users/mayan/lifeline/server/src/routes/health.js), [`server/src/index.js`](file:///c:/Users/mayan/lifeline/server/src/index.js)
* **Mechanism:**
  - `/api/v1/health/live`: Returns 200 if the Node event loop is responsive.
  - `/api/v1/health/ready`: Probes MongoDB connection (`readyState === 1`) and Redis ping. Returns 503 if any dependency is degraded.
  - Graceful Shutdown: `SIGTERM`/`SIGINT` traps stop accepting new HTTP requests, drain active connections (up to 10s), and cleanly close MongoDB connections.

---

## 4. Core Software Engineering & JavaScript Concepts

### A. JavaScript Event Loop: Microtasks vs Macrotasks
* **File:** [`client/src/components/EmergencyFormScreen.tsx`](file:///c:/Users/mayan/lifeline/client/src/components/EmergencyFormScreen.tsx#L114-L126)
* **Concept:**
  1. Synchronous code executes on the Call Stack.
  2. `await api(...)` yields control back to the event loop.
  3. `Promise.resolve().then(...)` schedules callbacks into the **Microtask Queue** (runs immediately when call stack empties, before repaint).
  4. `setTimeout(..., 0)` schedules callbacks into the **Macrotask (Timer) Queue** (runs in the subsequent event loop tick).

### B. JavaScript Function Declaration Hoisting
* **File:** [`server/src/services/authService.js`](file:///c:/Users/mayan/lifeline/server/src/services/authService.js#L181)
* **Concept:** The private helper `async function _createSession(user)` is declared at the bottom of the file using a function declaration. JavaScript hoists the entire function definition to the top of module scope, allowing top-level public functions (`signup`, `login`) to invoke it cleanly without Temporal Dead Zone (`ReferenceError`) issues.

### C. React Component Composition & State Isolation
* **File:** [`client/src/components/AuthScreen.tsx`](file:///c:/Users/mayan/lifeline/client/src/components/AuthScreen.tsx)
* **Concept:** Encapsulates 13 local form states (`isSignup`, `identifier`, `password`, `isDonor`, `bloodGroup`) within a clean single-prop interface (`AuthScreenProps { onSuccess: (user: User) => void }`), preventing root-level re-render thrashing in `App.tsx`.

### D. Client-Side Routing & Role-Based Guards
* **File:** [`client/src/App.tsx`](file:///c:/Users/mayan/lifeline/client/src/App.tsx#L180-L245)
* **Concept:** React Router v6 with `<BrowserRouter>`, `<Routes>`, and `<Route>`. Role-based redirection guards redirect donors to `/dashboard` and requesters to `/intake`.

---

## 5. Viva Defense Master Cheat Sheet ("Say This:" Scripts)

Whenever asked about a concept in the viva, follow the mandatory 4-part structure and speak the exact script below:

### 1. Load Balancing & Horizontal Scaling
> **Say this:**
> *"In `server/src/cluster.js` on lines 15 to 45 and `nginx/nginx.conf` on lines 10 to 28, we implement a two-tier load balancing architecture. At Layer 7, Nginx distributes incoming traffic across backend instances using `ip_hash` sticky sessions so Socket.io WebSocket upgrade handshakes stay pinned to the same server. Within each backend instance, `server/src/cluster.js` uses Node's native `cluster` module with `cluster.schedulingPolicy = cluster.SCHED_RR` round-robin scheduling to fork worker processes across all available CPU cores. If a worker process crashes on an unhandled error, the master's `cluster.on('exit')` event detects it and automatically respawns a replacement worker with crash-loop throttling. We chose this native cluster approach because it requires zero extra runtime dependencies while fully utilizing multi-core hardware."*

### 2. Circuit Breaker Pattern
> **Say this:**
> *"In `server/src/utils/circuitBreaker.js` on lines 15 to 95 and `server/src/services/aiService.js` on lines 25 to 45, we implemented a 3-state Circuit Breaker pattern wrapping the OpenRouter LLM API. When in the CLOSED state, it tracks consecutive failures. If the AI service experiences 3 consecutive network timeouts or HTTP errors, the breaker trips to the OPEN state for a 30-second cooldown period, causing all subsequent emergency intake calls to fast-fail instantly with zero latency directly into `parseEmergencyTextFallback()`. After 30 seconds, it enters HALF_OPEN and permits one trial request to test if the upstream API has recovered. This trade-off prevents third-party API latency from exhausting our server thread pools during emergency triage."*

### 3. Rate Limiting & Throttling
> **Say this:**
> *"In `server/src/middleware/rateLimiter.js` on lines 15 to 75 and mounted in `server/src/app.js` on lines 35 to 45, we implement a Sliding Window Rate Limiting middleware. It tracks client request volume per IP or user ID in Upstash Redis using `incr` and `expire` commands, with an in-memory timestamp queue as a fallback. We apply a general limit of 120 requests per minute on standard routes and a strict limit of 20 requests per minute on `/api/v1/auth/login` to prevent brute-force and credential stuffing attacks. When the threshold is exceeded, the server returns HTTP `429 Too Many Requests` along with a standard `Retry-After` header. This protects our database and LLM APIs from denial-of-service traffic."*

### 4. Distributed Concurrency Locking
> **Say this:**
> *"In `server/src/services/reservationService.js` on lines 32 to 55, we implement distributed concurrency locking using Upstash Redis. When a requester selects a donor, `reserveDonor()` executes an atomic `redis.set(lockKey, requestId, { nx: true, px: 900000 })` creating a 15-minute lock. If two requesters attempt to reserve the same donor at the exact same millisecond, Redis guarantees that only one command returns 'OK', while the second receives null and throws an HTTP 409 Conflict error. The trade-off of the 15-minute TTL is that a donor is temporarily locked from other requesters during their response window, but the automatic TTL prevents permanent deadlocks if a server crashes."*

### 5. Geospatial Aggregation Pipeline
> **Say this:**
> *"In `server/src/services/matchingService.js` on lines 46 to 98, the `findCandidates()` function executes a 5-stage MongoDB aggregation pipeline. It starts with `$geoNear` querying the `2dsphere` index on the User collection within a 50 km spherical radius, performs a `$lookup` to join the `DonorProfile` collection, `$unwinds` the profile, `$matches` against compatible blood groups and 'available' status, and `$sorts` by distance ascending and reliability score descending with a `$limit` of 10. If no donors are available within 50 km, `$geoNear` returns an empty array and the request transitions to 'expired'. Running this as a single pipeline in MongoDB avoids multiple round trips across the network."*

---

## 6. How to Run, Test, and Benchmark

### 1. Running in Single-Server Dev Mode
```bash
# Terminal 1: Backend Server (Port 5000)
cd server
npm run dev

# Terminal 2: Frontend Client (Port 5173)
cd client
npm run dev
```

### 2. Running in Multi-Core Cluster Mode
```bash
cd server
npm run dev:cluster
```

### 3. Running with Nginx Load Balancer (Docker)
```bash
docker-compose up --build
```

### 4. Running the Test Suite
```bash
cd server
npm test
```
*(All 37 Jest tests across 7 test suites will execute and pass)*

---

*LifeLine Architecture & Learning Guide — Compiled for Master Evaluation & Production Readiness.*
