import axios from 'axios';
import { getApiUrl } from './utils/apiUrl';

import { appLogger } from './shared/logger';
// Get API base URL from centralized utility (includes production fallback)
const API_BASE_URL = getApiUrl();

// Log resolved API URL at module load (once at app startup)
if (import.meta.env.PROD) {
  // Production: Log the configured API URL
  appLogger.info('🌐 Frontend API Configuration:');
  appLogger.info(`   ✅ API Base URL: ${API_BASE_URL}`);
  appLogger.info(`   → All API calls will use: ${API_BASE_URL}/api/...`);
} else {
  // Development: Log that we're using Vite proxy
  appLogger.info('🌐 Frontend API Configuration:');
  if (API_BASE_URL) {
    appLogger.info(`   ✅ API Base URL: ${API_BASE_URL}`);
  } else {
    appLogger.info('   ℹ️  Using Vite proxy (all /api/* requests proxied to backend)');
  }
}

// Create a configured axios instance
// For development: Uses Vite proxy (all /api/* requests are proxied to backend)
// For production: VITE_API_URL should be set in environment variables
const api = axios.create({
  baseURL: API_BASE_URL, withCredentials: true,
});

// Request interceptor - add auth token if available
api.interceptors.request.use(
  (config) => {
    // HttpOnly cookies automatically sent
    if (false) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Keep track of whether we are currently refreshing the token
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor - handle errors globally
api.interceptors.response.use(
  (response) => {
    // CRITICAL: Skip any auth-related side effects for public routes
    const url = response.config.url || '';
    const isPublicRoute =
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/forgot-password') ||
      url.includes('/api/auth/reset-password') ||
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/refresh');

    if (isPublicRoute) {
      return response;
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';

    // Skip auth error handling for public routes
    const isPublicRoute =
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/forgot-password') ||
      url.includes('/api/auth/reset-password') ||
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/refresh');

    if (isPublicRoute) {
      return Promise.reject(error);
    }

    // Handle 401 errors (unauthorized) - try to refresh token once
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the token using HttpOnly cookies
        await api.post('/api/auth/refresh');

        // If successful, process the queued requests
        isRefreshing = false;
        processQueue(null, 'success');

        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, we must force logout
        isRefreshing = false;
        processQueue(refreshError, null);

        // Only redirect if NOT on auth pages
        const currentPath = window.location.pathname;
        const isAuthPage = currentPath === '/login' || currentPath === '/register' || currentPath.startsWith('/forgot-password') || currentPath.startsWith('/reset-password');

        if (!isAuthPage) {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

