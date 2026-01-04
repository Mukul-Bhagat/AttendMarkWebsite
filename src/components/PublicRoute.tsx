import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

// Component to redirect logged-in users away from public pages (login/register)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { token, isLoading } = useAuth();

  // CRITICAL: On public routes, don't block on loading state
  // AuthContext should already have set isLoading: false immediately for public routes
  // But if it hasn't yet, we still show the page to prevent deadlock
  const isPublicRoute = 
    location.pathname === '/register' ||
    location.pathname === '/login' ||
    location.pathname.startsWith('/forgot-password') ||
    location.pathname.startsWith('/reset-password') ||
    location.pathname === '/landing';

  // Only show loading spinner if NOT on a public route and still loading
  // This prevents deadlock on registration/login pages
  if (isLoading && !isPublicRoute) {
    return <LoadingSpinner />;
  }

  // If user is already logged in, redirect to appropriate dashboard
  if (token) {
    // We can't check user role here without making an API call, so redirect to dashboard
    // The App.tsx root route will handle Platform Owner redirect
    return <Navigate to="/dashboard" replace />;
  }

  // If not logged in, show the public page immediately
  // Don't wait for auth checks on public routes
  return <>{children}</>;
};

export default PublicRoute;

