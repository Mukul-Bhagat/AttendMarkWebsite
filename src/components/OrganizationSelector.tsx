import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

interface Organization {
  orgName: string;
  organizationId: string;
  role: string;
  userId: string;
  organizationName: string;
}

interface OrganizationSelectorProps {
  organizations: Organization[];
  tempToken: string;
  email: string;
  redirectTo?: string;
  onError: (error: string) => void;
}

const OrganizationSelector: React.FC<OrganizationSelectorProps> = ({
  organizations,
  tempToken,
  email,
  redirectTo = '/dashboard',
  onError,
}) => {
  const [isLoading, setIsLoading] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const { login, user } = useAuth();

  // Safety net: If Platform Owner somehow lands here, redirect immediately
  useEffect(() => {
    if (user?.role === 'PLATFORM_OWNER') {
      navigate('/platform/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Check if user is Platform Owner from organizations array and redirect immediately
  React.useEffect(() => {
    const isPlatformOwner = organizations && organizations.length > 0 && organizations[0].role === 'PLATFORM_OWNER';
    if (isPlatformOwner) {
      // Auto-select first organization and redirect to platform dashboard
      const autoSelectAndRedirect = async () => {
        try {
          const response = await api.post('/api/auth/select-organization', {
            tempToken,
            organizationId: organizations[0].organizationId,
          });

          const { token, user } = response.data;
          localStorage.setItem('token', token);
          await login({ token, user });
          navigate('/platform/dashboard', { replace: true });
        } catch (err: any) {
          const errorMessage = err.response?.data?.msg || 'Failed to select organization. Please try again.';
          onError(errorMessage);
        }
      };
      autoSelectAndRedirect();
    }
  }, [organizations, tempToken, login, navigate, onError]);

  const handleSelectOrganization = async (org: Organization) => {
    setIsLoading(org.organizationId);
    try {
      const response = await api.post('/api/auth/select-organization', {
        tempToken,
        organizationId: org.organizationId,
      });

      const { token, user } = response.data;

      // Store token and update AuthContext
      localStorage.setItem('token', token);

      // Update AuthContext with the new token and user
      await login({ token, user });

      // Navigate to the appropriate dashboard based on user role
      if (user.role === 'PLATFORM_OWNER') {
        navigate('/platform/dashboard', { replace: true });
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (err: any) {
      setIsLoading(null);
      const errorMessage = err.response?.data?.msg || 'Failed to select organization. Please try again.';
      onError(errorMessage);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SuperAdmin':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-800';
      case 'CompanyAdmin':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800';
      case 'Manager':
        return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-300 dark:border-green-800';
      case 'SessionAdmin':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800';
      case 'EndUser':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'SuperAdmin':
        return 'Super Admin';
      case 'CompanyAdmin':
        return 'Company Admin';
      case 'SessionAdmin':
        return 'Session Admin';
      default:
        return role;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Select Your Workspace
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-8 font-medium">
          Logged in as: <strong>{email}</strong>
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          You have access to {organizations.length} organization{organizations.length !== 1 ? 's' : ''}. Choose one to continue.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl mx-auto">
        {organizations.map((org) => (
          <div
            key={org.organizationId}
            className="relative flex flex-col justify-between rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg hover:border-primary/50 transition-all duration-200 hover:scale-105 p-6 cursor-pointer group min-h-[200px] w-full"
            onClick={() => !isLoading && handleSelectOrganization(org)}
          >
            {/* Organization Name - Centered */}
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white line-clamp-2">
                {org.organizationName}
              </h3>
            </div>

            {/* Role Badge - Centered */}
            <div className="mb-4 flex justify-center">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(org.role)}`}
              >
                {getRoleDisplayName(org.role)}
              </span>
            </div>

            {/* Enter Button - Full width with whitespace-nowrap to prevent text cutoff */}
            <button
              type="button"
              disabled={isLoading !== null}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectOrganization(org);
              }}
              className={`mt-auto w-full whitespace-nowrap flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-gradient-to-r from-orange-500 to-[#f04129] text-white text-sm font-bold hover:from-orange-600 hover:to-[#d63a25] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isLoading === org.organizationId ? 'opacity-70' : ''
                }`}
            >
              {isLoading === org.organizationId ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Entering...</span>
                </>
              ) : (
                <>
                  <span>Enter Workspace</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                  </svg>
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrganizationSelector;

