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
    const fallbackPath = `/scan-web?token=${encodedToken}`;

    let fallbackTriggered = false;
    const fallbackTimer = window.setTimeout(() => {
      fallbackTriggered = true;
      navigate(fallbackPath, { replace: true });
    }, 1400);

    const visibilityHandler = () => {
      if (document.visibilityState === 'hidden' && !fallbackTriggered) {
        window.clearTimeout(fallbackTimer);
      }
    };

    document.addEventListener('visibilitychange', visibilityHandler);

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = deepLinkUrl;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 350);
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
              If not, you will continue in the web scanner flow.
            </p>
            {qrToken && (
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <a
                  href={`attendmark://scan?token=${encodeURIComponent(qrToken)}`}
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-[#d63a25]"
                >
                  Open App Manually
                </a>
                <button
                  type="button"
                  onClick={() => navigate(`/scan-web?token=${encodeURIComponent(qrToken)}`, { replace: true })}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Continue on Web
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ScanDeepLinkBridge;
