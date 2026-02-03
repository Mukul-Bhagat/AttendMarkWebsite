import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import OrganizationSelector from '../components/OrganizationSelector';
import api from '../api';

// Helper functions for sessionStorage (moved outside component to avoid recreation)
const getStoredError = (): string => {
  try {
    return sessionStorage.getItem('loginError') || '';
  } catch {
    return '';
  }
};

const setStoredError = (errorMsg: string): void => {
  try {
    if (errorMsg) {
      sessionStorage.setItem('loginError', errorMsg);
    } else {
      sessionStorage.removeItem('loginError');
    }
  } catch {
    // Ignore sessionStorage errors
  }
};

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const emailInputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
  const errorPersistRef = useRef<string>('');

  // Get the redirect path from location state, default to /dashboard
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const { email, password } = formData;

  // Auto-focus email input on mount
  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  // Restore error from sessionStorage/ref on mount (in case component was remounted)
  useEffect(() => {
    const storedError = getStoredError();
    if (storedError && !error) {
      setError(storedError);
      errorPersistRef.current = storedError;
    } else if (errorPersistRef.current && !error) {
      setError(errorPersistRef.current);
    }
  }, []);

  // Memoize clear error function
  const clearError = useCallback(() => {
    setError('');
    errorPersistRef.current = '';
    setStoredError('');
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    // Clear error when user starts typing
    if (error || errorPersistRef.current || getStoredError()) {
      clearError();
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling

    // Clear any previous errors before new attempt
    if (error || errorPersistRef.current || getStoredError()) {
      clearError();
    }

    setIsSubmitting(true);

    try {
      // Call the new login endpoint that returns organizations
      const response = await api.post('/api/auth/login', formData);

      const { tempToken: token, organizations: orgs } = response.data;

      // CRITICAL: Check if user is Platform Owner at the very top and force redirect
      // Check role from organizations array (Platform Owner orgs will have role 'PLATFORM_OWNER')
      if (orgs && orgs.length > 0 && orgs[0].role === 'PLATFORM_OWNER') {
        // For Platform Owner, we need to select an organization to get a token
        // Use the first organization (or any organization - Platform Owner can access all)
        const selectResponse = await api.post('/api/auth/select-organization', {
          tempToken: token,
          organizationId: orgs[0].organizationId,
        });

        const { token: finalToken, user } = selectResponse.data;

        // Double-check user role from the response
        if (user.role === 'PLATFORM_OWNER') {
          localStorage.setItem('token', finalToken);

          // Use the login function to update context
          await login({ token: finalToken, user });

          // Force redirect to platform dashboard immediately
          navigate('/platform/dashboard', { replace: true });
          return; // Stop execution - do not proceed to organization selection
        }
      }

      // If only one organization, auto-select it
      if (orgs && orgs.length === 1) {
        const selectResponse = await api.post('/api/auth/select-organization', {
          tempToken: token,
          organizationId: orgs[0].organizationId,
        });

        const { token: finalToken, user } = selectResponse.data;
        localStorage.setItem('token', finalToken);

        // Use the login function to update context
        await login({ token: finalToken, user });

        // Navigate to the original destination or appropriate dashboard
        if (user.role === 'PLATFORM_OWNER') {
          navigate('/platform/dashboard', { replace: true });
        } else {
          navigate(from || '/dashboard', { replace: true });
        }
      } else if (orgs && orgs.length > 1) {
        // Show organization selector
        setOrganizations(orgs);
        setTempToken(token);
      } else {
        throw new Error('No organizations found for this user');
      }
    } catch (err: any) {
      // Don't navigate on error - stay on login page and show error
      const status = err.response?.status;
      let errorMessage = '';

      // Friendly message for invalid credentials
      if (status === 401) {
        errorMessage = 'Email and password is invalid. Please check your credentials and try again.';
      } else if (err.response?.data) {
        // Handle express-validator errors (array format)
        if (err.response.data.errors && Array.isArray(err.response.data.errors)) {
          errorMessage = err.response.data.errors.map((e: any) => e.msg).join(', ');
        } else {
          errorMessage = err.response.data.msg || 'Login failed';
        }
      } else if (err.message) {
        // Handle network errors
        errorMessage = err.message || 'Login failed. Please check your connection and try again.';
      } else {
        errorMessage = 'Login failed. Please check your connection and try again.';
      }

      // Store in multiple places to persist across remounts
      setStoredError(errorMessage);
      errorPersistRef.current = errorMessage;
      setError(errorMessage);

      // Restore error if component remounts (check after a brief delay)
      setTimeout(() => {
        const stored = getStoredError();
        if (stored) {
          setError(prevError => prevError || stored);
        }
      }, 50);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get error from most persistent source first (sessionStorage > ref > state)
  const { errorText, hasError } = useMemo(() => {
    const storedError = getStoredError();
    const text = (error?.trim() || errorPersistRef.current?.trim() || storedError?.trim() || '');
    return { errorText: text, hasError: text.length > 0 };
  }, [error]);

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-background-light dark:bg-background-dark" style={{ fontFamily: 'Manrope, "Noto Sans", sans-serif' }}>
      {/* Left Side - Branding Panel */}
      <div className="hidden md:flex md:w-1/2 h-full bg-slate-900 flex-col items-center justify-center text-center p-12">
        <Link to="/landing" className="flex flex-col items-center gap-6 text-white cursor-pointer hover:opacity-80 transition-opacity">
          <div className="flex items-center gap-3">
            <svg className="h-10 w-10 text-primary" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
            <h1 className="font-display text-4xl font-bold tracking-tight">AttendMark</h1>
          </div>
          <p className="max-w-xs text-lg font-light text-slate-300">Marking presence, perfecting performance. Your success, recorded.</p>
        </Link>
      </div>

      {/* Right Side - Form Container */}
      <div className="w-full md:w-1/2 h-full flex flex-col bg-background-light dark:bg-background-dark">
        {/* Top - Logo */}
        <div className="flex-none pt-6 pb-2 flex justify-center">
          <Link to="/landing" className="cursor-pointer hover:opacity-80 transition-opacity">
            <img
              src="/assets/attendmarklogo.png"
              alt="AttendMark"
              className="h-16 w-auto object-contain"
            />
          </Link>
        </div>

        {/* Middle - Form or Organization Selector */}
        <div className={`flex-grow flex flex-col justify-center px-4 sm:px-8 ${organizations.length > 0 && tempToken ? 'max-w-6xl' : 'max-w-md'} mx-auto w-full overflow-y-auto`}>
          {organizations.length > 0 && tempToken ? (
            <OrganizationSelector
              organizations={organizations}
              tempToken={tempToken}
              email={email}
              redirectTo={from}
              onError={(errorMsg) => {
                setError(errorMsg);
                setOrganizations([]);
                setTempToken(null);
              }}
            />
          ) : (
            <div className="flex flex-col">
              <h1 className="text-slate-900 dark:text-white tracking-light text-2xl font-bold leading-tight mb-4">Welcome back</h1>
              <form onSubmit={onSubmit} noValidate className="flex flex-col space-y-3">
                <label className="flex flex-col flex-1">
                  <p className="text-slate-900 text-sm font-medium leading-normal pb-1">Email</p>
                  <input
                    ref={emailInputRef}
                    className="w-full rounded-lg text-slate-900 dark:text-white dark:bg-slate-900 dark:border-slate-600 focus:outline-0 border border-slate-300 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 h-11 px-3 text-sm font-normal leading-normal placeholder:text-gray-400 dark:placeholder:text-slate-500"
                    placeholder="you@example.com"
                    type="email"
                    name="email"
                    value={email}
                    onChange={onChange}
                    required
                    autoComplete="email"
                  />
                </label>

                <label className="flex flex-col flex-1">
                  <p className="text-slate-900 text-sm font-medium leading-normal pb-1">Password</p>
                  <div className="relative w-full">
                    <input
                      className="w-full rounded-lg text-slate-900 dark:text-white dark:bg-slate-900 dark:border-slate-600 focus:outline-0 border border-slate-300 bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 h-11 px-3 pr-10 text-sm font-normal leading-normal placeholder:text-gray-400 dark:placeholder:text-slate-500"
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={password}
                      onChange={onChange}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-primary z-10 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </label>

                <div className="flex justify-end pt-1">
                  <Link to="/forgot-password" className="text-slate-900 dark:text-slate-300 text-sm font-medium leading-normal underline hover:text-primary cursor-pointer">
                    Forgot Password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isLoading}
                  className={`flex items-center justify-center text-center font-bold text-sm h-11 w-full rounded-lg bg-primary text-white hover:bg-[#d63a25] transition-colors duration-200 mt-2 ${isSubmitting || isLoading ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                >
                  {isSubmitting || isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                      </svg>
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </button>
              </form>

              {!organizations.length && (
                <div className="mt-3">
                  <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                    Don't have an account? <Link to="/register" className="font-bold text-primary underline hover:text-primary/90">Register here</Link>
                  </p>
                </div>
              )}

              {/* Error Alert */}
              {hasError && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3" role="alert" aria-live="polite">
                  <span className="material-symbols-outlined text-red-500 text-lg">error</span>
                  <p className="text-sm font-medium text-red-500">{errorText}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom - Footer */}
        <div className="flex-none py-4 text-center border-t border-slate-200">
          <a
            href="https://aially.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <p className="text-xs text-slate-500 font-medium">Powered By</p>
            <img
              src="/assets/image01.png"
              alt="AI ALLY Logo"
              className="h-5 w-auto object-contain"
            />
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

