import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

const ScanDeepLinkBridge: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token: authToken, isLoading } = useAuth();

  const qrToken = useMemo(() => {
    const value = searchParams.get('token') || searchParams.get('qrToken');
    return value?.trim() || '';
  }, [searchParams]);

  useEffect(() => {
    if (isLoading) return;

    if (!qrToken) {
      if (authToken) {
        const queryString = searchParams.toString();
        const target = queryString ? `/scan-web?${queryString}` : '/scan-web';
        navigate(target, { replace: true });
      } else {
        navigate('/login', { replace: true, state: { from: location } });
      }
      return;
    }

    const encodedToken = encodeURIComponent(qrToken);
    const deepLinkUrl = `attendmark://scan?token=${encodedToken}`;
    const fallbackPath = `/app-download?token=${encodedToken}`;

    let fallbackTriggered = false;
    const fallbackTimer = window.setTimeout(() => {
      fallbackTriggered = true;
      navigate(fallbackPath, { replace: true });
    }, 1500);

    const visibilityHandler = () => {
      if (document.visibilityState === 'hidden' && !fallbackTriggered) {
        window.clearTimeout(fallbackTimer);
      }
    };

    document.addEventListener('visibilitychange', visibilityHandler);
    window.location.href = deepLinkUrl;

    return () => {
      window.clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [authToken, isLoading, location, navigate, qrToken, searchParams]);

  return (
    <div className="group/design-root relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Opening AttendMark App
            </h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              If the app is installed, this link will open it automatically.
              If not, you will be redirected to the download page.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ScanDeepLinkBridge;
