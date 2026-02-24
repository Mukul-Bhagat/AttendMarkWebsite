import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import api from '../api';
import { Role, RoleProfile, resolveRole } from '../shared/roles';

import { appLogger } from '../shared/logger';
// Define the shape of the user object and the auth context
export interface IUser {
  id: string;
  email: string;
  role: string;
  rawRole?: string;
  canonicalRole?: Role;
  roleProfile?: RoleProfile;
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    bio?: string;
  };
  profileImageUrl?: string;
  profilePicture?: string;
  createdAt?: string;
  mustResetPassword: boolean;
  organization?: string; // This is actually organizationName from backend
  organizationName?: string;
  organizationId?: string;
  organizationLogo?: string;
  organizationLogoUrl?: string;
  collectionPrefix?: string; // Legacy
}

interface IAuthContext {
  user: IUser | null;
  token: string | null;
  isLoading: boolean;
  login: (formData: any) => Promise<void>;
  logout: () => void;
  refetchUser: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  // Role helper booleans
  isSuperAdmin: boolean;
  isCompanyAdmin: boolean;
  isManager: boolean;
  isSessionAdmin: boolean;
  isEndUser: boolean;
  isPlatformOwner: boolean;
}

// Create the context
const AuthContext = createContext<IAuthContext | undefined>(undefined);

const normalizeAuthUser = (user: IUser): IUser => {
  const fallbackRawRole = String(user.rawRole || user.role || '').trim();

  try {
    const resolved = resolveRole(fallbackRawRole);
    return {
      ...user,
      role: fallbackRawRole,
      rawRole: fallbackRawRole,
      canonicalRole: resolved.role,
      roleProfile: resolved.roleProfile,
    };
  } catch {
    return {
      ...user,
      role: fallbackRawRole,
      rawRole: fallbackRawRole,
      canonicalRole: Role.USER,
      roleProfile: RoleProfile.END_USER,
    };
  }
};

// Define the provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // CRITICAL: Check if we're on a public route immediately to avoid blocking
  const getIsPublicRoute = () => {
    if (typeof window === 'undefined') return false;
    const currentPath = window.location.pathname;
    return (
      currentPath === '/register' ||
      currentPath === '/login' ||
      currentPath.startsWith('/forgot-password') ||
      currentPath.startsWith('/reset-password') ||
      currentPath === '/landing'
    );
  };

  const [user, setUser] = useState<IUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // Start with isLoading: false on public routes to prevent blocking
  const [isLoading, setIsLoading] = useState(!getIsPublicRoute());

  // Derived role states - helper booleans for easy role checking
  const isSuperAdmin = user?.roleProfile === RoleProfile.SUPER_ADMIN;
  const isCompanyAdmin = user?.roleProfile === RoleProfile.COMPANY_ADMIN;
  const isManager = user?.roleProfile === RoleProfile.MANAGER;
  const isSessionAdmin = user?.roleProfile === RoleProfile.SESSION_ADMIN;
  const isEndUser = user?.roleProfile === RoleProfile.END_USER;
  const isPlatformOwner = user?.canonicalRole === Role.PLATFORM_OWNER;

  // On initial load, try to load user from token
  useEffect(() => {
    const initAuth = async () => {
      // CRITICAL: Skip auth initialization on public routes
      // This prevents automatic auth checks after registration, forgot password, etc.
      const currentPath = window.location.pathname;
      const isPublicRoute =
        currentPath === '/register' ||
        currentPath === '/login' ||
        currentPath.startsWith('/forgot-password') ||
        currentPath.startsWith('/reset-password') ||
        currentPath === '/landing';

      // If on a public route, skip auth initialization completely
      // Set loading to false immediately to prevent blocking
      if (isPublicRoute) {
        setIsLoading(false);
        setUser(null);
        return;
      }

      try {
        // With HttpOnly cookies, we just hit the endpoint to see if session is valid
        const response = await api.get('/api/auth/me');
        const { user } = response.data;

        setUser(normalizeAuthUser(user));
        setToken('cookie-auth');
      } catch (err: any) {
        appLogger.error('Failed to verify session:', err);
        setToken(null);
        setUser(null);
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Login function - can accept formData (for old flow) or { user } (for new flow)
  const login = async (formDataOrAuth: any) => {
    setIsLoading(true);
    try {
      if (formDataOrAuth.user) {
        setToken('cookie-auth');
        setUser(normalizeAuthUser(formDataOrAuth.user));
        setIsLoading(false);
        return;
      }

      const response = await api.post('/api/auth/login', formDataOrAuth);
      const { user } = response.data;

      setToken('cookie-auth');
      setUser(normalizeAuthUser(user));
      setIsLoading(false);
    } catch (error: any) {
      setIsLoading(false);
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    setToken(null);
    setUser(null);
    api.post('/api/auth/logout').catch(console.error);
  };

  // Refetch user data from the backend
  const refetchUser = async () => {
    if (!token) return;

    try {
      const response = await api.get('/api/auth/me');
      const { user } = response.data;
      setUser(normalizeAuthUser(user));
    } catch (err: any) {
      appLogger.error('Failed to refetch user:', err);
      // If session is invalid, logout
      logout();
    }
  };

  // Switch to a different organization
  const switchOrganization = async (organizationId: string) => {
    try {
      const response = await api.post('/api/auth/switch-organization', {
        organizationId,
      });

      const { user } = response.data;

      // Clear org-scoped UI state/cache before applying new context
      try {
        sessionStorage.clear();
      } catch {
        // Ignore storage errors (private mode / disabled storage)
      }

      // Update user state
      setToken('cookie-auth');
      setUser(normalizeAuthUser(user));

      // Reload the page to refresh the dashboard with new organization context
      window.location.href = '/dashboard';
    } catch (err: any) {
      appLogger.error('Failed to switch organization:', err);
      throw err;
    }
  };

  const value = {
    user,
    token,
    isLoading,
    login,
    logout,
    refetchUser,
    switchOrganization,
    isSuperAdmin,
    isCompanyAdmin,
    isManager,
    isSessionAdmin,
    isEndUser,
    isPlatformOwner,
  };

  // CRITICAL: Don't block rendering on public routes
  // On public routes, always render children immediately to prevent deadlock
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const isPublicRoute =
    currentPath === '/register' ||
    currentPath === '/login' ||
    currentPath.startsWith('/forgot-password') ||
    currentPath.startsWith('/reset-password') ||
    currentPath === '/landing';

  return (
    <AuthContext.Provider value={value}>
      {/* On public routes, always render immediately. On protected routes, wait for auth check. */}
      {(isPublicRoute || !isLoading) ? children : null}
    </AuthContext.Provider>
  );
};

// Custom hook to easily use the context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
