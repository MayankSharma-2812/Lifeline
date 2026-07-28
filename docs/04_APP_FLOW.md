# LifeLine — App Flow (build reference for Antigravity)

## 1. Auth Flow
1. **Signup** → name, phone, email, password, blood group (if donor), location (auto-detect or manual pin).
2. **Login** → email/password → access token (in-memory) + refresh token/sessionId (httpOnly cookie) → Redis session created.
3. Access token silently refreshes via `/auth/refresh` when it expires (15 min) — user shouldn't notice this happening.
4. **Logout** → Redis session deleted; refresh cookie is now dead even if still present client-side.
5. **Session-revoked toast** — if a session is deleted remotely (e.g. logged out from another tab/device), show a non-blocking toast, not a jarring forced redirect.

## 2. Requester Journey
1. **Landing/Intake** → large free-text box ("Describe what you need"), optional voice input, "Find Help Now" button.
2. Submit → loading state → AI parses text into `{bloodGroup, urgency}`.
3. **Confirm-parse screen** → editable chips showing what AI understood, "Confirm & Search" button.
4. **Matches screen** → ranked donor cards: distance, reliability score, one-line AI explanation, "Reserve" button.
5. **Reserve** → Redis lock acquired → countdown timer + live status stepper (Pending → Matched → Reserved → Confirmed) via Socket.io.
6. Donor confirms → contact reveal.
7. Donor declines/timeout → toast "No response — matched with next nearest donor," UI updates automatically.

## 3. Donor Journey
1. **Register** as donor → blood group, location, availability toggle.
2. Idle until matched → real-time banner: "Emergency request nearby, respond within 15 min," Accept/Decline buttons, countdown timer.
3. Accept → status confirmed, contact details shared both ways.
4. Decline/timeout (or the MVP's manual "Simulate no-response" button during demo) → lock released, reliability score adjusted, request escalates to next donor.

## 4. Demo Script (for the recorded viva — rehearse this exact sequence)
1. Two browser windows: Requester and Donor, side by side.
2. Sign up/log in in both.
3. Submit a free-text request in the Requester window.
4. Show the AI-parsed structured output on the confirm-parse screen.
5. Show ranked matches with AI explanations.
6. Reserve the top match → show the real-time notification appear instantly in the Donor window.
7. **Open a third window/incognito tab, try to reserve the same already-reserved donor → show the conflict error.** This is the single strongest visual proof of the Redis lock working — make it the centerpiece.
8. Let the TTL expire (or click decline) → show live escalation to the next candidate.
9. In one window, log out and show the other session becoming invalid — proof of the Redis session-revocation design.
