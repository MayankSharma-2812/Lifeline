# LifeLine 🩸

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/Tests-37%2F37%20Passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)]()
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)]()
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)]()
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7-black.svg)]()
[![Redis](https://img.shields.io/badge/Redis-Upstash-red.svg)]()
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%202dsphere-forestgreen.svg)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon%20%2F%20Prisma-indigo.svg)]()

> **Hyperlocal emergency blood-donor matching platform with AI natural-language triage, 50km geospatial radius matching, Redis distributed concurrency locking, and real-time Socket.io dispatch.**

---

## 🌐 Live Demo & Visual Proof

### 🔗 Live Hosted Links
- **Web App (Vercel):** [https://lifeline-app.vercel.app](https://lifeline-app.vercel.app)
- **API Server (Render):** [https://lifeline-server.onrender.com/api/v1/health/live](https://lifeline-server.onrender.com/api/v1/health/live)

---

### 📸 Application Interface Gallery

| 1. AI Emergency Intake | 2. Geospatial Candidate Matching |
|:---:|:---:|
| ![Emergency Intake](docs/screenshots/emergency-intake.png) | ![Matching Screen](docs/screenshots/matching-screen.png) |
| *Natural language extraction (`gpt-4o-mini` with regex fallback) & GPS detection.* | *5-stage MongoDB `$geoNear` aggregation ranked by distance & reliability.* |

| 3. Distributed Reservation Lock | 4. Donor Real-Time Dashboard |
|:---:|:---:|
| ![Reservation Status](docs/screenshots/reservation-status.png) | ![Donor Dashboard](docs/screenshots/donor-dashboard.png) |
| *Atomic Redis lock (`SET NX PX 900s`) with live countdown & auto-escalation.* | *Real-time incoming alerts via private Socket.io room (`user:<id>`).* |

| 5. Polyglot Audit Trail Verification |
|:---:|
| ![Audit Trail](docs/screenshots/audit-verify.png) |
| *Relational compliance verification stored in PostgreSQL Neon via Prisma with SQL LEFT JOINs.* |

---

## ⚡ Key Features & System Design Architecture

1. **AI-Powered Natural Language Triage (OpenRouter + gpt-4o-mini):**
   - Parses unstructured distress messages into structured JSON: `{ bloodGroup, urgency }`.
   - **Circuit Breaker Pattern (`server/src/utils/circuitBreaker.js`):** 3-state state machine (Closed, Open, Half-Open) fast-failing to deterministic regex extraction during third-party API outages.
2. **High-Performance Geospatial Engine (MongoDB Atlas 2dsphere):**
   - Multi-stage aggregation pipeline (`$geoNear` $\rightarrow$ `$lookup` $\rightarrow$ `$unwind` $\rightarrow$ `$match` $\rightarrow$ `$sort`) searching within 50 km spherical radius.
   - Dynamic mathematical ranking: $\text{Rank}(d) = 1.0 \cdot \text{Distance} - 0.5 \cdot \text{ReliabilityScore}$.
3. **Double-Booking Elimination (Upstash Redis Distributed Locks):**
   - Atomic `SET lock:donor:<id> <requestId> NX PX 900000` guarantees zero double-booking under concurrent traffic.
   - 15-minute response window with auto-escalation to the next candidate on timeout or decline.
4. **Real-Time Bidirectional Dispatch (Socket.io):**
   - Authenticated WebSocket handshake with personal user rooms (`user:<userId>`) and emergency request rooms (`request:<requestId>`).
5. **Two-Tier Load Balancing & Horizontal Scaling:**
   - **Native Multi-Core Cluster (`server/src/cluster.js`):** Round-robin process scheduling (`cluster.SCHED_RR`) across all CPU cores with self-healing auto-respawn.
   - **Layer 7 Nginx Reverse Proxy (`nginx/nginx.conf`):** Upstream pool with `ip_hash` **Sticky Sessions** for WebSocket handshake stability.
6. **Sliding Window Rate Limiting (`server/src/middleware/rateLimiter.js`):**
   - Redis sliding window counters (120 req/min general, 20 req/min auth) returning HTTP `429 Too Many Requests`.
7. **Polyglot Persistence & Compliance Audit Trail:**
   - Dual-write architecture: MongoDB for geospatial document storage + PostgreSQL Neon via Prisma for immutable audit compliance logs.

---

## 🏗️ Architecture Diagram

```mermaid
graph TD
    Client["Client (React 18 + TypeScript + Vite)"] --> Nginx["Nginx L7 Load Balancer (:80)"]
    
    subgraph "Reverse Proxy & Sticky Routing"
        Nginx -- "ip_hash (WebSocket Affinity)" --> Master1["Node.js Cluster Master"]
    end

    subgraph "Multi-Core Worker Pool"
        Master1 --> W1["Worker 1 (CPU Core 1)"]
        Master1 --> W2["Worker 2 (CPU Core 2)"]
    end

    W1 & W2 --> RateLimit["Sliding Window Rate Limiter"]
    RateLimit --> AuthGuard["JWT Authentication Guard"]
    
    AuthGuard --> Matching["Geospatial Matching Engine"]
    AuthGuard --> Locking["Distributed Locking Service"]
    AuthGuard --> AIService["Circuit Breaker -> OpenRouter LLM"]
    
    Matching --> Mongo[("MongoDB Atlas (2dsphere Index)")]
    Locking --> Redis[("Upstash Redis (SET NX PX)")]
    Locking --> Neon[("PostgreSQL Neon (Prisma SQL Audit)")]
    Locking --> Sockets["Socket.io Real-Time Dispatch"]
```

---

## 📂 Project Structure

```
lifeline/
├── client/                     # React 18 + TypeScript + Vite + Tailwind CSS SPA
│   ├── src/
│   │   ├── components/         # Screen views (Auth, Intake, Matching, Reservation, Dashboard)
│   │   ├── hooks/              # Custom hooks (useSocket, useRequestStatus, useDonorNotifications)
│   │   ├── lib/                # Axios HTTP client interceptors & Socket.io client singleton
│   │   └── types/              # Domain TypeScript interfaces & status enums
│   └── vite.config.ts          # Vite configuration with API & WebSocket proxying
│
├── server/                     # Node.js + Express REST API & WebSocket Backend
│   ├── src/
│   │   ├── cluster.js          # Native multi-core cluster master/worker load balancer
│   │   ├── index.js            # Server entry point & graceful shutdown handlers
│   │   ├── app.js              # Express app setup, rate limiting, and correlation tracing
│   │   ├── config/             # DB (Mongoose), Redis (Upstash), and Prisma client configs
│   │   ├── middleware/         # Auth (JWT), RateLimiter (Redis), CorrelationId (UUID)
│   │   ├── models/             # Mongoose schemas (User, DonorProfile, EmergencyRequest, AuditLog)
│   │   ├── routes/             # Versioned REST endpoints (/auth, /requests, /donors, /health)
│   │   ├── services/           # Business logic (matchingService, reservationService, aiService)
│   │   ├── socket.js           # Socket.io authentication and room management
│   │   └── utils/              # CircuitBreaker, bloodCompatibility matrix, corsOriginHandler
│   ├── prisma/                 # Prisma PostgreSQL schema for relational audit logs
│   └── __tests__/              # Jest test suites (unit, concurrency, circuit breaker, rate limit)
│
├── nginx/                      # Layer 7 Reverse Proxy & Load Balancer configuration
│   └── nginx.conf              # Upstream pool with ip_hash sticky sessions
├── docker-compose.yml          # Containerized orchestration for Nginx + multi-backend
├── docs/                       # Architectural specifications (PRD.md, HLD.md, LLD.md)
├── PROJECT_LEARNING_GUIDE.md   # Master project & system design concept guide
└── LICENSE                     # MIT Open-Source License
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **MongoDB Atlas Connection URI**
- **Upstash Redis REST Credentials**

### 1. Clone & Install

```bash
git clone https://github.com/MayankSharma-2812/Lifeline.git
cd lifeline
```

### 2. Configure Environment Variables

Create `server/.env` with your credentials:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/lifeline?retryWrites=true&w=majority
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
DATABASE_URL=postgresql://user:pass@ep-host.neon.tech/lifeline?sslmode=require
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-4o-mini
CLIENT_ORIGIN=http://localhost:5173
```

### 3. Run in Development Mode

```bash
# Terminal 1: Backend Server (Port 5000)
cd server
npm install
npm run dev

# Terminal 2: Frontend Client (Port 5173)
cd client
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### 4. Running Multi-Core Cluster Mode

To utilize all available CPU cores via the native Cluster Load Balancer:

```bash
cd server
npm run dev:cluster
```

### 5. Running with Docker Compose (Nginx Load Balancer)

```bash
docker-compose up --build
```

---

## 🧪 Running Automated Tests

LifeLine includes comprehensive test coverage verifying matching logic, AI parsing, concurrent reservation locking, circuit breaker state transitions, and rate limiting.

```bash
cd server
npm test
```

### Test Suite Summary:
```
PASS __tests__/bloodCompatibility.test.js
PASS __tests__/matchingService.test.js
PASS __tests__/reservation.concurrent.test.js
PASS __tests__/aiService.test.js
PASS __tests__/circuitBreaker.test.js
PASS __tests__/rateLimiter.test.js
PASS __tests__/health.test.js

Test Suites: 7 passed, 7 total
Tests:       37 passed, 37 total
```

---

## 📡 API Reference Overview

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/api/v1/auth/signup` | Register requester or donor (with bloodGroup) | No |
| `POST` | `/api/v1/auth/login` | Authenticate by email/phone & set session cookie | No |
| `POST` | `/api/v1/auth/refresh` | Rotate JWT access token via httpOnly cookie | No |
| `GET` | `/api/v1/auth/me` | Fetch currently authenticated user profile | **Yes** |
| `POST` | `/api/v1/requests` | Submit emergency text with GPS coordinates | **Yes** |
| `GET` | `/api/v1/requests/:id/matches`| Retrieve ranked candidates with AI explanation | **Yes** |
| `POST` | `/api/v1/requests/:id/reserve`| Acquire Redis NX lock on chosen donor | **Yes** |
| `POST` | `/api/v1/requests/:id/confirm`| Confirm donation, apply +2 score, cooldown | **Yes** |
| `POST` | `/api/v1/requests/:id/decline`| Decline / timeout, trigger auto-escalation | **Yes** |
| `GET` | `/api/v1/requests/:id/audit-trail` | Fetch SQL relational audit trail | **Yes** |
| `GET` | `/api/v1/health/live` | Liveness health probe for load balancers | No |
| `GET` | `/api/v1/health/ready` | Readiness probe checking Mongo & Redis | No |

---

## 📚 In-Depth Documentation

- **[Master Project & Learning Guide](PROJECT_LEARNING_GUIDE.md):** Complete deep-dive into every concept, code reference, and viva defense script.
- **[Product Requirement Document (PRD)](docs/PRD.md):** Requirements, user personas, and concept traceability matrix.
- **[High-Level Design (HLD)](docs/HLD.md):** System topology, polyglot persistence, and load balancing architecture.
- **[Low-Level Design (LLD)](docs/LLD.md):** Database schemas, state machines, API specifications, and code mappings.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details.
