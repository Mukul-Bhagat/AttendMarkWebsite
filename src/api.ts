import axios from 'axios';

// Create a configured axios instance
// For development: Uses Vite proxy (all /api/* requests are proxied to backend)
// For production: VITE_API_URL should be set in environment variables
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
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
  (response) => response,
  (error) => {
    // Handle 401 errors (unauthorized)
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

