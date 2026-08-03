/**
 * @module api.ts
 * @description Configures and exports the Axios HTTP client. Centralizes all API requests and manages authentication state via request and response interceptors.
 */
import axios from 'axios';
import { BloodGroup, Candidate, DonorProfile, EmergencyRequest, Role, User } from '../types';

/**
 * Retrieves the base URL for the API from the environment configuration.
 * Automatically appends the standard API path suffix if it is absent.
 *
 * @returns The normalized base URL.
 */
function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (!envUrl) return '/api/v1';
  const clean = envUrl.replace(/\/$/, '');
  return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true, // sends httpOnly refresh cookie
});

// Maintain a local reference to the active JWT access token to support bearer authorization headers.
let _accessToken: string | null = null;

/**
 * Updates the globally stored access token.
 *
 * @param token - The new JWT string, or null to clear the token.
 */
export function setAccessToken(token: string | null) {
  _accessToken = token;
}

/**
 * Retrieves the currently active access token.
 *
 * @returns The active JWT string, or null if unauthenticated.
 */
export function getAccessToken(): string | null {
  return _accessToken;
}

// Request interceptor: attach bearer token to all outgoing requests
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Controls concurrency during a token refresh operation to prevent multiple simultaneous requests.
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

/**
 * Resolves or rejects the backlog of requests that failed due to a missing or expired token.
 *
 * @param error - Optional error if the token refresh ultimately failed.
 * @param token - Optional new JWT if the token refresh succeeded.
 */
function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Detect unauthorized responses for automated silent refresh handling
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Prevent loops on explicit authentication endpoints
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
        return Promise.reject(error);
      }

      // If a refresh is already in progress, suspend this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${getApiBaseUrl()}/auth/refresh`, {}, { withCredentials: true });
        const newToken = res.data.accessToken;
        setAccessToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setAccessToken(null);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth Endpoints ───────────────────────────────────────────────

/**
 * Authenticates an existing user and populates local state.
 *
 * @param identifier - The user's email or identifier string.
 * @param password - The user's password string.
 * @returns The user profile and access token.
 */
export async function loginApi(identifier: string, password: string): Promise<{ user: User; accessToken: string }> {
  const res = await api.post('/auth/login', { identifier, email: identifier, password });
  setAccessToken(res.data.accessToken);
  return res.data;
}

/**
 * Registers a new user.
 *
 * @param data - The required account data parameters.
 * @returns The created user profile and access token.
 */
export async function signupApi(data: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
  bloodGroup?: BloodGroup;
  location?: { lat: number; lng: number };
}): Promise<{ user: User; accessToken: string }> {
  const res = await api.post('/auth/signup', data);
  setAccessToken(res.data.accessToken);
  return res.data;
}

/**
 * Performs a silent refresh of the JWT via HTTP-only cookies.
 *
 * @returns The newly obtained access token.
 */
export async function refreshApi(): Promise<{ accessToken: string }> {
  const res = await api.post('/auth/refresh');
  setAccessToken(res.data.accessToken);
  return res.data;
}

/**
 * Terminates the user session by notifying the server and clearing local variables.
 */
export async function logoutApi(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

// ── Requests Endpoints ───────────────────────────────────────────

/**
 * Creates a new emergency blood request.
 *
 * @param rawText - The unformatted string description of the emergency.
 * @param location - The latitude and longitude representing the location of the emergency.
 * @returns The parsed request data and matched candidate profiles.
 */
export async function createEmergencyRequestApi(
  rawText: string,
  location: { lat: number; lng: number }
): Promise<{
  requestId: string;
  parsed: EmergencyRequest['parsed'];
  candidates: Candidate[];
}> {
  const res = await api.post('/requests', { rawText, location });
  return res.data;
}

/**
 * Retrieves the currently matched candidates for a specified request.
 *
 * @param requestId - The ID of the emergency request.
 * @returns The request details and the list of eligible candidates.
 */
export async function getMatchesApi(requestId: string): Promise<{
  requestId: string;
  status: string;
  parsed: EmergencyRequest['parsed'];
  candidates: Candidate[];
}> {
  const res = await api.get(`/requests/${requestId}/matches`);
  return res.data;
}

/**
 * Retrieves the complete audit log associated with a specific request.
 *
 * @param requestId - The ID of the emergency request.
 * @returns The audit trail history for compliance verification.
 */
export async function getAuditTrailApi(requestId: string): Promise<{
  requestId: string;
  auditTrail: Array<{
    id: string;
    action: string;
    actorId: string;
    timestamp: string;
    donor?: { id: string; mongoDonorId: string; name: string; bloodGroup: string } | null;
    metadata?: any;
  }>;
}> {
  const res = await api.get(`/requests/${requestId}/audit-trail`);
  return res.data;
}

/**
 * Issues a concurrency lock request for a specific donor candidate.
 *
 * @param requestId - The ID of the emergency request.
 * @param donorProfileId - The ID of the target donor profile.
 * @returns The confirmation message and the unique lock key.
 */
export async function reserveDonorApi(
  requestId: string,
  donorProfileId: string
): Promise<{ message: string; lockKey: string; donorProfileId: string }> {
  const res = await api.post(`/requests/${requestId}/reserve`, { donorProfileId });
  return res.data;
}

/**
 * Confirms a successful lock reservation, transitioning the match status to finalized.
 *
 * @param requestId - The ID of the emergency request.
 * @param donorProfileId - The ID of the target donor profile.
 * @returns A confirmation message.
 */
export async function confirmReservationApi(
  requestId: string,
  donorProfileId: string
): Promise<{ message: string }> {
  const res = await api.post(`/requests/${requestId}/confirm`, { donorProfileId });
  return res.data;
}

/**
 * Drops the active lock on a candidate and proceeds with the next eligible option.
 *
 * @param requestId - The ID of the emergency request.
 * @param donorProfileId - The ID of the declined donor profile.
 * @param outcome - Optional descriptor detailing the refusal reason.
 * @returns A confirmation message and the subsequent best candidate, if available.
 */
export async function declineReservationApi(
  requestId: string,
  donorProfileId: string,
  outcome: 'declined' | 'no_response' = 'declined'
): Promise<{ message: string; nextCandidate?: Candidate | null }> {
  const res = await api.post(`/requests/${requestId}/decline`, { donorProfileId, outcome });
  return res.data;
}

// ── Donors Endpoints ─────────────────────────────────────────────

/**
 * Retrieves the profile metadata and active status for the currently authenticated donor.
 *
 * @returns The donor's profile configuration and active reservation if any.
 */
export async function getMyDonorProfileApi(): Promise<{
  profile: DonorProfile;
  activeReservation?: { requestId: string; donorProfileId: string; expiresInSeconds: number; rawText?: string; urgency?: string } | null;
}> {
  const res = await api.get('/donors/me');
  return res.data;
}

/**
 * Switches a donor's broad availability status.
 *
 * @param donorProfileId - The ID of the specific donor profile to toggle.
 * @returns The updated active status.
 */
export async function toggleDonorAvailabilityApi(
  donorProfileId: string
): Promise<{ donorProfileId: string; status: string; isAvailable: boolean }> {
  const res = await api.post(`/donors/${donorProfileId}/availability`);
  return res.data;
}

export default api;
