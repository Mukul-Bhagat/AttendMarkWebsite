import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

type UserRole = 'SuperAdmin' | 'CompanyAdmin' | 'Manager' | 'SessionAdmin' | 'EndUser' | 'PLATFORM_OWNER';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { token, isLoading, user } = useAuth();
  const location = useLocation();

  // Show a loading spinner while context is checking for a token
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // If there is no token, redirect to the /login page with current location as state
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // CRITICAL: Wait for user data to be loaded before allowing access
  // This prevents race conditions where token exists but user object is still null
  // Also check that user.profile exists to prevent crashes when accessing user.profile.firstName
  if (!user || !user.profile) {
    return <LoadingSpinner />;
  }

  // If allowedRoles is specified, check if user's role is in the allowed list
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role as UserRole)) {
      // User doesn't have the required role, redirect to dashboard
      return <Navigate to="/dashboard" replace />;
    }
  }

  // If there is a token and role check passes, show the child component
  // The <Outlet> renders the *nested* routes (e.g., /dashboard)
  return <Outlet />;
};

export default ProtectedRoute;

