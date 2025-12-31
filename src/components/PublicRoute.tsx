import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

// Component to redirect logged-in users away from public pages (login/register)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isLoading } = useAuth();

  // Show loading spinner while checking
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // If user is already logged in, redirect to appropriate dashboard
  if (token) {
    // We can't check user role here without making an API call, so redirect to dashboard
    // The App.tsx root route will handle Platform Owner redirect
    return <Navigate to="/dashboard" replace />;
  }

  // If not logged in, show the public page
  return <>{children}</>;
};

export default PublicRoute;

