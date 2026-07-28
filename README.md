# LifeLine

Hyperlocal emergency blood-donor matching app — MERN stack.

## Project structure

```
/client   React + Vite + TypeScript + Tailwind
/server   Express + Mongoose + Socket.io
/docs     PRD, HLD, LLD
/design-reference  HTML/Tailwind screen references
```

## Quick start

```bash
# Server
cd server
cp ../.env.example .env   # fill in your values
npm install
npm run dev

# Client (new terminal)
cd client
npm install
npm run dev
```

## Running server tests

```bash
cd server
npm test
```

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB Atlas (2dsphere geospatial index) |
| Sessions / Locking | Redis (ioredis) |
| Real-time | Socket.io |
| AI | OpenRouter (model-agnostic) |
| Testing | Jest |

See `/docs/PRD.md`, `/docs/HLD.md`, `/docs/LLD.md` for design rationale.
