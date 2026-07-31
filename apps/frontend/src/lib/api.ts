import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Single axios instance — baseURL includes /api/v1 so all routes just use /auth/..., /workflows/..., etc.
const api = axios.create({
  baseURL: 'http://localhost:4000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
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
