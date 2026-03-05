import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const AppDownload: React.FC = () => {
  const [searchParams] = useSearchParams();

  const token = useMemo(() => {
    const value = searchParams.get('token') || searchParams.get('qrToken');
    return value?.trim() || '';
  }, [searchParams]);

  const deepLink = token
    ? `attendmark://scan?token=${encodeURIComponent(token)}`
    : 'attendmark://scan';

  return (
    <div className="group/design-root relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">
              Get AttendMark App
            </h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              This attendance QR is handled securely in the AttendMark mobile app.
              Install the app on your Android device and scan again.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={deepLink}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-[#d63a25]"
              >
                Open AttendMark App
              </a>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Open Web Login
              </Link>
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <p className="font-semibold">Installation notes</p>
              <p className="mt-1">
                1. Install AttendMark on your Android phone.
                2. Re-open this link to continue attendance securely.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppDownload;

