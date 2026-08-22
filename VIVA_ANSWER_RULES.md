# Viva Answer Rules — read before answering ANY Project Score question

This file exists because the automated viva assessor does NOT give credit for
correct-but-vague answers. It only credits answers that name exact evidence.
Every answer must follow the structure below or it will likely score 0 for
that concept even if the underlying implementation is correct.

## Before answering, always do this analysis (in order)

1. **Identify the concept being asked** (e.g. "Indexing for query performance (Mongo)").
2. **Find the exact file(s)** in this repo where that concept is implemented.
   Search the actual codebase — do not answer from general knowledge of what
   "should" be there. If you can't find it, say so instead of guessing.
3. **Pull the exact mechanism**: function name, schema field, config key, line
   of logic — not the general pattern name.
4. **Find one failure/edge case** tied to that same piece of code — what
   happens if it's empty, races, times out, gets bad input, or scales up.
5. **Find one trade-off** — what alternative existed, why this was chosen,
   what it costs.
6. Only then write the answer.

## Required answer shape (every single time)

**[1] Location** — "In `<exact file>`, the `<exact function/field/route>`..."
**[2] Mechanism** — describe precisely what it does, in your own words, with
    enough specificity that someone could find the line from the description.
**[3] Edge case / failure mode** — one concrete scenario and what actually
    happens (not "we handle errors gracefully" — say what error, what code
    path, what the user/system sees).
**[4] Trade-off or reasoning** — why this approach over an alternative, and
    what it costs you (performance, complexity, correctness, security).

4-6 sentences total. No filler, no restating the question, no hedging language
("I believe", "I think we sort of").

## Hard rules from observed scoring pattern

- Never answer with only the pattern name ("we used Tailwind for responsiveness")
  — that alone has repeatedly scored 0. Always attach [1]-[4] above.
- Never invent a file, field, or line that isn't actually in the repo. A wrong
  specific reference is worse than a vague one — cite only from what's
  actually confirmed present in the codebase.
- If the concept genuinely isn't implemented yet, say that plainly instead of
  stretching an unrelated feature to cover it. A clean "not yet implemented,
  here's how I'd do it and why" is more defensible than a forced stretch.
- If PRD/HLD/LLD is directly relevant, cite the specific section/heading, not
  just "as I mentioned in my HLD."
- Distinguish adjacent concepts explicitly when relevant (e.g. don't blur
  401 vs 403 vs 400, or embedding vs referencing, or SQL JOIN vs Mongo $lookup) 
  — the assessor has penalized exactly this kind of blur before.
- For JS fundamentals (event loop, closures, hoisting, promises vs async/await)
  — always tie the definition back to one real line in this repo that uses it,
  not just a textbook explanation.

## Concept → known evidence map (fill in and keep updated per project)

| Concept | File(s) | Exact mechanism | Known edge case | Known trade-off |
|---|---|---|---|---|
| **State management with useState** | [`client/src/components/EmergencyFormScreen.tsx`](file:///c:/Users/mayan/lifeline/client/src/components/EmergencyFormScreen.tsx), [`AuthScreen.tsx`](file:///c:/Users/mayan/lifeline/client/src/components/AuthScreen.tsx) | `const [lat, setLat] = useState(26.9124)`, `const [rawText, setRawText] = useState('')` | GPS permission denied -> sets error text, keeps numeric fallback to avoid undefined crash in `$geoNear` | Local component state vs global store; simple local state avoids prop-drilling overhead in shallow tree |
| **Side effects with useEffect** | [`client/src/App.tsx`](file:///c:/Users/mayan/lifeline/client/src/App.tsx) | Line 66 `useEffect([], initAuth)` calling `refreshApi()`; Line 57 `useEffect([dark])` syncing `document.documentElement.classList` | Token refresh fails on bad cookie -> caught in `try/catch`, sets `initializing: false` | Direct effect in App vs Redux/Zustand; React state keeps cleanup simple |
| **Async data fetching from API** | [`client/src/lib/api.ts`](file:///c:/Users/mayan/lifeline/client/src/lib/api.ts) | `api.interceptors.response.use` catches 401, sets `isRefreshing = true`, calls `axios.post('/auth/refresh')` | Parallel requests fail at same millisecond -> pushed to `failedQueue`, replayed on refresh | In-memory token wiped on refresh; solved by silent cookie refresh on mount |
| **Loading & error UI states** | [`client/src/components/EmergencyFormScreen.tsx`](file:///c:/Users/mayan/lifeline/client/src/components/EmergencyFormScreen.tsx), [`AuthScreen.tsx`](file:///c:/Users/mayan/lifeline/client/src/components/AuthScreen.tsx) | Line 73 renders `<Skeleton count={3} />`; Line 137 renders `<div className="bg-error-container">` with `<AlertCircle />` | Slow network during AI parse -> skeleton matches layout; prevents layout shift | Skeleton component dependency vs simple text spinner; higher UX quality |
| **Form handling — controlled inputs** | [`client/src/components/EmergencyFormScreen.tsx`](file:///c:/Users/mayan/lifeline/client/src/components/EmergencyFormScreen.tsx) | Controlled textarea `value={rawText} onChange={(e) => setRawText(e.target.value)}`, preset buttons | Empty submit `!rawText.trim()` -> short-circuits with error message before API call | Controlled input re-renders on keystroke; negligible overhead for short text |
| **Form validation** | [`server/src/routes/auth.js`](file:///c:/Users/mayan/lifeline/server/src/routes/auth.js) | `express-validator` middleware array: `body('email').isEmail()`, `body('bloodGroup').if(...).isIn(BLOOD_GROUPS)` | Malformed body or NoSQL injection (`{ "$gt": "" }`) -> returns `400 Bad Request` | Middleware validation overhead (~1ms) vs database corruption / NoSQL injection risk |
| **Client-side routing** | [`client/src/App.tsx`](file:///c:/Users/mayan/lifeline/client/src/App.tsx) | React Router v6 `<Route path="/intake"...>`, `useParams<{ id: string }>()` in `ReservationRouteWrapper` | Donor hits `/intake` -> Role guard auto-redirects to `/dashboard` | Client-side routing requires server catch-all (`vercel.json` rewrites `/(.*)` to `/index.html`) |
| **Schema modeling (Mongo)** | [`server/src/models/EmergencyRequest.js`](file:///c:/Users/mayan/lifeline/server/src/models/EmergencyRequest.js) | Hybrid document: embedded `parsed` and `escalationHistory` array; referenced `requesterId` -> `User` | Document growth if escalation runs 100+ times; capped at 10 candidates | Embedded array avoids multi-collection `$lookup` joins during rapid 15m auto-escalation |
| **Indexing for performance (Mongo)** | [`server/src/models/EmergencyRequest.js`](file:///c:/Users/mayan/lifeline/server/src/models/EmergencyRequest.js), [`DonorProfile.js`](file:///c:/Users/mayan/lifeline/server/src/models/DonorProfile.js) | Line 43 `index({ location: '2dsphere' })`; Line 44 `index({ requesterId: 1, status: 1 })`; `DonorProfile` `index({ bloodGroup: 1, status: 1 })` | Queries without index -> full collection scan; index ensures $O(\log N)$ spatial search | Index memory overhead in RAM vs sub-10ms query execution |
| **Aggregation pipelines (Mongo)** | [`server/src/services/matchingService.js`](file:///c:/Users/mayan/lifeline/server/src/services/matchingService.js) | `findCandidates()` 5-stage pipeline: `$geoNear` (50km) -> `$lookup` -> `$unwind` -> `$match` -> `$sort` -> `$limit: 10` -> `$project` | Zero compatible donors within 50km -> `$geoNear` returns empty array, request marked 'expired' | Single pipeline execution in Mongo vs multi-query round trips in Node.js |
| **Relational schema design (PK/FK)** | [`server/prisma/schema.prisma`](file:///c:/Users/mayan/lifeline/server/prisma/schema.prisma) | `DonorReference` (`donors_reference`) & `AuditEvent` (`audit_events`) with FK `donorId` -> `DonorReference.id` (`onDelete: SetNull`) | Donor profile deleted -> audit trail preserved with `donorId = null` | Polyglot dual-write overhead vs immutable relational compliance reporting |
| **SQL JOINs** | [`server/src/services/auditService.js`](file:///c:/Users/mayan/lifeline/server/src/services/auditService.js) | Line 93 `prisma.auditEvent.findMany({ where: { requestId }, include: { donor: true }, orderBy: { timestamp: 'asc' } })` | Postgres unavailable -> caught in `try/catch`, falls back to MongoDB `AuditLog.find()` | Prisma generates SQL `LEFT JOIN`; eliminates N+1 queries when fetching timeline |
| **Distributed locking / Redis** | [`server/src/services/reservationService.js`](file:///c:/Users/mayan/lifeline/server/src/services/reservationService.js) | Line 32 `redis.set(lockKey, requestId, { nx: true, px: 900000 })` | Two users reserve same donor at same millisecond -> 1 gets 'OK', 2nd gets null -> `409 Conflict` | 15-minute lock auto-expires on crash (PX), but donor is locked from others during window |
| **Auth & Security / JWT** | [`server/src/middleware/auth.js`](file:///c:/Users/mayan/lifeline/server/src/middleware/auth.js), [`authService.js`](file:///c:/Users/mayan/lifeline/server/src/services/authService.js) | `authenticate` extracts `auth.slice(7)`, `jwt.verify(token, JWT_SECRET)`, sets `req.userId` | Expired token -> throws, caught in catch block, returns `401 Unauthorized` | 15m short-lived access token reduces stolen token risk; requires refresh rotation |
| **AI API integration & Structured outputs** | [`server/src/services/aiService.js`](file:///c:/Users/mayan/lifeline/server/src/services/aiService.js) | `_openrouterRequest()` with `response_format: { type: 'json_object' }` and 8s `AbortController` timeout (`PARSE_TIMEOUT_MS = 8000`) | LLM timeout / rate limit -> `catch` triggers `parseEmergencyTextFallback()` regex | 8s wait on timeout vs 100% uptime with deterministic regex fallback |
| **JavaScript — Hoisting** | [`server/src/services/authService.js`](file:///c:/Users/mayan/lifeline/server/src/services/authService.js) | Line 175 `async function _createSession(user)` function declaration hoisted to module top, allowing lines 82 (`signup`) and 108 (`login`) to invoke it before its physical line | Using `const _createSession = ...` throws `ReferenceError` (TDZ) when called before definition | Function declaration hoisting permits clean code organization (public exports at top, private helpers below) vs strict lexical order |
| **JavaScript — Promises vs callbacks** | [`client/src/components/EmergencyFormScreen.tsx`](file:///c:/Users/mayan/lifeline/client/src/components/EmergencyFormScreen.tsx) | Line 40 `navigator.geolocation.getCurrentPosition(successCb, errorCb)` error-first callback vs line 64 `await createEmergencyRequestApi(...)` async-await Promise | Callback style requires separate error handlers and nests callbacks; Promise/async-await unifies error handling in `try/catch/finally` | Native callback APIs require promisification wrappers if chained; async/await simplifies sequential async logic |
| **JavaScript — Event loop** | [`client/src/components/EmergencyFormScreen.tsx`](file:///c:/Users/mayan/lifeline/client/src/components/EmergencyFormScreen.tsx) | Line 61 `setLoading(true)` runs synchronously on Call Stack, `await` yields thread to Event Loop to render `<Skeleton />` before network microtask resolves | If state were set after `await`, UI would remain static with no loading indicator during network latency | Microtask dispatch yields thread to Event Loop for paint, adding sub-millisecond dispatch overhead for responsive UX |
| **Git workflow** | [`CONTRIBUTING.md`](file:///c:/Users/mayan/lifeline/CONTRIBUTING.md) | `master` (production releases) + `develop` (integration) + `feature/*` branches with Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`) | Direct pushes to `master` can trigger instant failed Vercel/Render deploys; branch isolation prevents broken builds | Branching + PR overhead vs stability and auditable commit history |

Keep this table updated as concepts get implemented/confirmed — reuse it
instead of re-deriving the answer from scratch each viva attempt.

## Final step — always end with a "Say this" script

After the [1]-[4] analysis above, always close with a section titled
**"Say this:"** containing the exact words to speak out loud in the viva,
in quotes, ready to read/rehearse as-is. This is the part that actually
matters in the room — the analysis above is just how you got there.

Rules for how that quoted script must sound:

- Write it the way a tired final-year student explains their own project to
  a senior dev, not the way a report or documentation would explain it.
  Contractions are fine ("I didn't," "it's," "we're"). Short sentences.
  Occasional restart or hedge is fine ("so basically," "the main reason was,"
  "yeah so").
- Avoid AI-tell phrasing: no "leverage," "robust," "seamless," "ensures that,"
  "it's worth noting," "in order to," "furthermore," symmetrical three-item
  lists, or perfectly balanced sentence structure. Real spoken explanations
  are lopsided — one long thought, one short correction, a specific detail
  that doesn't need to be there but is because it's a real memory, not a
  generated one.
- Use the specific vocabulary this project's owner would actually reach for
  (match whatever terms show up in their own code comments, PRD wording, or
  earlier answers) rather than generic textbook synonyms.
- It should sound slightly imperfect — like something said once and half
  improvised — not like a polished essay answer. Full marks come from
  sounding like someone who lived in the code, not someone reciting a script
  about the code.
- Keep it roughly the same length as the [1]-[4] analysis, just spoken instead
  of written. Don't pad it or add flourishes that weren't in the analysis.
