import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import api from '../api';

// Define the shape of the user object and the auth context
export interface IUser {
  id: string;
  email: string;
  role: 'SuperAdmin' | 'CompanyAdmin' | 'Manager' | 'SessionAdmin' | 'EndUser' | 'PLATFORM_OWNER';
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    bio?: string;
  };
  profilePicture?: string;
  createdAt?: string;
  mustResetPassword: boolean;
  organization?: string; // This is actually organizationName from backend
  organizationName?: string;
  organizationId?: string;
  organizationLogo?: string;
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
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  // Start with isLoading: false on public routes to prevent blocking
  const [isLoading, setIsLoading] = useState(!getIsPublicRoute());

  // Derived role states - helper booleans for easy role checking
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const isCompanyAdmin = user?.role === 'CompanyAdmin';
  const isManager = user?.role === 'Manager';
  const isSessionAdmin = user?.role === 'SessionAdmin';
  const isEndUser = user?.role === 'EndUser';
  const isPlatformOwner = user?.role === 'PLATFORM_OWNER';

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
        // Clear any stale tokens on public routes to ensure clean state
        if (localStorage.getItem('token')) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
        return;
      }

      const storedToken = localStorage.getItem('token');

      if (storedToken) {
        try {
          // Verify the token and fetch user data from the backend
          const response = await api.get('/api/auth/me');
          const { user } = response.data;

          // Update state with fetched user data
          setUser(user);
          setToken(storedToken);
        } catch (err: any) {
          // Token is invalid or expired, clear it
          console.error('Failed to verify token:', err);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Login function - can accept formData (for old flow) or { token, user } (for new flow)
  const login = async (formDataOrAuth: any) => {
    setIsLoading(true);
    try {
      // If formDataOrAuth already has token and user, it's from the new flow
      if (formDataOrAuth.token && formDataOrAuth.user) {
        setToken(formDataOrAuth.token);
        setUser(formDataOrAuth.user);
        localStorage.setItem('token', formDataOrAuth.token);
        setIsLoading(false);
        return;
      }

      // Otherwise, it's the old flow (shouldn't happen with new login, but kept for compatibility)
      const response = await api.post('/api/auth/login', formDataOrAuth);

      // Get token and user from response
      const { token, user } = response.data;
      // Save to state and localStorage
      setToken(token);
      setUser(user);
      localStorage.setItem('token', token);

      setIsLoading(false);
    } catch (error: any) {
      setIsLoading(false);
      // Re-throw the error so LoginPage can catch it and display the message
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    // Clear everything
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  // Refetch user data from the backend
  const refetchUser = async () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      return;
    }

    try {
      const response = await api.get('/api/auth/me');
      const { user } = response.data;
      setUser(user);
    } catch (err: any) {
      console.error('Failed to refetch user:', err);
      // If token is invalid, logout
      logout();
    }
  };

  // Switch to a different organization
  const switchOrganization = async (organizationId: string) => {
    try {
      const response = await api.post('/api/auth/switch-organization', {
        organizationId,
      });

      const { token, user } = response.data;

      // Update token and user
      setToken(token);
      setUser(user);
      localStorage.setItem('token', token);

      // Reload the page to refresh the dashboard with new organization context
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('Failed to switch organization:', err);
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
