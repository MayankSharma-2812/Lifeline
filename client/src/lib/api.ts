import axios from 'axios';

/**
 * Axios instance — base URL is relative so the Vite proxy handles routing in dev.
 * In production, set VITE_API_BASE_URL if the backend is on a different domain.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  withCredentials: true, // required to send/receive the httpOnly refresh-token cookie
});

// ── Request interceptor — attach access token from in-memory store ──
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── In-memory access token store (never localStorage — XSS risk) ────
let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}
export function getAccessToken() {
  return _accessToken;
}

// ── Response interceptor — silent refresh on 401 ────────────────────
// Implemented in Phase 1 once auth endpoints exist.

export default api;
