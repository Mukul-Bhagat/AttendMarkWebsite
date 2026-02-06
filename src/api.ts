import axios from 'axios';
import { getApiUrl } from './utils/apiUrl';

// Get API base URL from centralized utility (includes production fallback)
const API_BASE_URL = getApiUrl();

// Log resolved API URL at module load (once at app startup)
if (import.meta.env.PROD) {
  // Production: Log the configured API URL
  console.log('🌐 Frontend API Configuration:');
  console.log(`   ✅ API Base URL: ${API_BASE_URL}`);
  console.log(`   → All API calls will use: ${API_BASE_URL}/api/...`);
} else {
  // Development: Log that we're using Vite proxy
  console.log('🌐 Frontend API Configuration:');
  if (API_BASE_URL) {
    console.log(`   ✅ API Base URL: ${API_BASE_URL}`);
  } else {
    console.log('   ℹ️  Using Vite proxy (all /api/* requests proxied to backend)');
  }
}

// Create a configured axios instance
// For development: Uses Vite proxy (all /api/* requests are proxied to backend)
// For production: VITE_API_URL should be set in environment variables
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor - add auth token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors globally
api.interceptors.response.use(
  (response) => {
    // CRITICAL: Skip any auth-related side effects for public routes
    // This prevents automatic auth checks after registration, forgot password, etc.
    const url = response.config.url || '';
    const isPublicRoute =
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/forgot-password') ||
      url.includes('/api/auth/reset-password');

    // For public routes, return response immediately without any side effects
    if (isPublicRoute) {
      return response;
    }

    // For all other routes, return response normally
    return response;
  },
  (error) => {
    // CRITICAL: Skip auth error handling for public routes
    // This prevents redirects and token clearing after registration failures
    const url = error.config?.url || '';
    const isPublicRoute =
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/forgot-password') ||
      url.includes('/api/auth/reset-password');

    // For public routes, let the error propagate without any auth side effects
    if (isPublicRoute) {
      return Promise.reject(error);
    }

    // Handle 401 errors (unauthorized) - only for protected routes
    if (error.response?.status === 401) {
      // Clear token if it exists
      localStorage.removeItem('token');

      // Only redirect if NOT on login/register pages
      // This allows login page to handle its own 401 errors and show error messages
      const currentPath = window.location.pathname;
      const isAuthPage = currentPath === '/login' || currentPath === '/register' || currentPath.startsWith('/forgot-password') || currentPath.startsWith('/reset-password');

      if (!isAuthPage) {
        // Redirect to login only if we're on a protected page
        window.location.href = '/login';
      }
      // If we're already on login page, let the error propagate so LoginPage can handle it
    }
    return Promise.reject(error);
  }
);

export default api;

