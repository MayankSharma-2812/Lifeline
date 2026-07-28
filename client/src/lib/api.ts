import axios from 'axios';
import { BloodGroup, Candidate, DonorProfile, EmergencyRequest, Role, User } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  withCredentials: true, // sends httpOnly refresh cookie
});

// In-memory access token store
let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

// Request interceptor: attach bearer token
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: silent refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

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

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
        return Promise.reject(error);
      }

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
        const res = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
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

export async function loginApi(identifier: string, password: string): Promise<{ user: User; accessToken: string }> {
  const res = await api.post('/auth/login', { identifier, password });
  setAccessToken(res.data.accessToken);
  return res.data;
}

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

export async function refreshApi(): Promise<{ accessToken: string }> {
  const res = await api.post('/auth/refresh');
  setAccessToken(res.data.accessToken);
  return res.data;
}

export async function logoutApi(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

// ── Requests Endpoints ───────────────────────────────────────────

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

export async function getMatchesApi(requestId: string): Promise<{
  requestId: string;
  status: string;
  parsed: EmergencyRequest['parsed'];
  candidates: Candidate[];
}> {
  const res = await api.get(`/requests/${requestId}/matches`);
  return res.data;
}

export async function reserveDonorApi(
  requestId: string,
  donorProfileId: string
): Promise<{ message: string; lockKey: string; donorProfileId: string }> {
  const res = await api.post(`/requests/${requestId}/reserve`, { donorProfileId });
  return res.data;
}

export async function confirmReservationApi(
  requestId: string,
  donorProfileId: string
): Promise<{ message: string }> {
  const res = await api.post(`/requests/${requestId}/confirm`, { donorProfileId });
  return res.data;
}

export async function declineReservationApi(
  requestId: string,
  donorProfileId: string,
  outcome: 'declined' | 'no_response' = 'declined'
): Promise<{ message: string; nextCandidate?: Candidate | null }> {
  const res = await api.post(`/requests/${requestId}/decline`, { donorProfileId, outcome });
  return res.data;
}

// ── Donors Endpoints ─────────────────────────────────────────────

export async function getMyDonorProfileApi(): Promise<{ profile: DonorProfile }> {
  const res = await api.get('/donors/me');
  return res.data;
}

export async function toggleDonorAvailabilityApi(
  donorProfileId: string
): Promise<{ donorProfileId: string; status: string; isAvailable: boolean }> {
  const res = await api.post(`/donors/${donorProfileId}/availability`);
  return res.data;
}

export default api;
