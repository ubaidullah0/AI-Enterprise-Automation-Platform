import axios from 'axios';
import { useAuthStore } from '../store/authStore';

/**
 * Central Axios instance.
 *
 * Uses a RELATIVE base URL ('/api/v1') so that requests go through
 * Vite's dev proxy → backend at localhost:4000.
 *
 * This means it works on ANY port Vite picks (5173, 5174, etc.)
 * and in production (where the reverse proxy handles /api/v1).
 *
 * Never hardcode 'http://localhost:4000' here — that bypasses the
 * proxy and breaks CORS when Vite is on a different port.
 */
// Determine the correct backend URL:
// 1. Use VITE_API_URL if explicitly set (highest priority)
// 2. In production (not localhost), use the Render backend URL
// 3. In local dev, use relative '/api/v1' which goes through Vite proxy → localhost:4000
const isLocalDev = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

let baseURL: string;
if (import.meta.env.VITE_API_URL) {
  baseURL = import.meta.env.VITE_API_URL;
  if (baseURL.startsWith('http') && !baseURL.endsWith('/api/v1')) {
    baseURL = `${baseURL.replace(/\/$/, '')}/api/v1`;
  }
} else if (isLocalDev) {
  // Local development — use Vite proxy
  baseURL = '/api/v1';
} else {
  // Production (Vercel) — point directly to Render backend
  baseURL = 'https://ai-enterprise-automation-platform.onrender.com/api/v1';
}

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Automatically attach Bearer token and X-Organization-ID header
api.interceptors.request.use((config) => {
  const state = useAuthStore.getState();
  const token = state.accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (state.user?.activeOrganizationId) {
    config.headers['X-Organization-ID'] = state.user.activeOrganizationId;
  }

  return config;
});

// ─── Response Interceptor ─────────────────────────────────────────────────────
// On 401, clear auth state and redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export { api };
export default api;
