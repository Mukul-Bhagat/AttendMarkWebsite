import React, { useState } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import Toast from '../components/Toast';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      // Send only email - backend does not need organization name
      const { data } = await api.post('/api/auth/forgot-password', { email });

      // Show success message and toast
      const successMessage = data.msg || 'If that email exists in our system, you will receive a password reset link.';
      setMessage(successMessage);
      setToast({
        message: successMessage,
        type: 'success',
      });
    } catch (err: any) {
      // Extract error message
      let errorMessage = 'An error occurred. Please try again.';

      if (err.response?.data?.errors) {
        errorMessage = err.response.data.errors.map((e: any) => e.msg).join(', ');
      } else if (err.response?.data?.msg) {
        errorMessage = err.response.data.msg;
      } else if (err.request) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setToast({
        message: errorMessage,
        type: 'error',
      });
    } finally {
      // CRITICAL: Always reset loading state using finally block
      // This ensures the UI never gets stuck, even if error handling fails
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-slate-900 group/design-root" style={{ fontFamily: 'Manrope, "Noto Sans", sans-serif' }}>
      <div className="flex h-full grow flex-col">
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md space-y-8 rounded-xl bg-white dark:bg-slate-800 p-8 shadow-lg border border-slate-200 dark:border-slate-700">
            {/* Logo */}
            <div className="flex justify-center">
              <img
                src="/assets/attendmarklogo.png"
                alt="AttendMark"
                className="h-14 w-auto object-contain dark:hidden"
              />
              <img
                src="/assets/atendmarkwhitelogo.png"
                alt="AttendMark"
                className="h-14 w-auto object-contain hidden dark:block"
              />
            </div>

            {/* Header */}
            <div className="text-center">
              <h1 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight">
                Forgot Password
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Enter your registered email address.
                <br />
                If an account exists, you will receive a password reset link.
              </p>
            </div>

            {/* Success Message */}
            {message && (
              <div className="flex items-center gap-3 rounded-lg border border-green-500/50 bg-green-500/10 p-4" role="alert">
                <span className="material-symbols-outlined text-green-600 dark:text-green-400" style={{ fontSize: '24px' }}>check_circle</span>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">{message}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-4" role="alert">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: '24px' }}>error</span>
                <p className="text-sm font-medium text-red-500">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-5">
              <label className="flex flex-col">
                <p className="text-slate-900 dark:text-slate-200 text-sm font-medium leading-normal pb-2">
                  Your Email
                </p>
                <input
                  className="form-input flex w-full min-w-0 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-white focus:outline-0 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:border-[#f04129] focus:ring-2 focus:ring-[#f04129]/20 h-12 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 text-base font-normal leading-normal disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  required
                  disabled={!!message || isSubmitting}
                  autoComplete="email"
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting || !!message}
                className={`flex items-center justify-center text-center font-bold text-base h-12 w-full rounded-lg bg-[#f04129] text-white hover:bg-[#d63a25] transition-colors duration-200 ${(isSubmitting || message) ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                    </svg>
                    Sending...
                  </>
                ) : message ? (
                  <>
                    <span className="material-symbols-outlined mr-2" style={{ fontSize: '20px' }}>check</span>
                    Email Sent!
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>

            {/* Back to Login Link */}
            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-[#f04129] dark:hover:text-[#f04129] transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
                Back to Login
              </Link>
            </div>

            {/* Powered By AI ALLY Logo */}
            <div className="flex items-center justify-center pt-4 border-t border-slate-200 dark:border-slate-700" style={{ gap: '8px' }}>
              <a
                href="https://aially.in"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ gap: '8px' }}
              >
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Powered By</p>
                <img
                  src="/assets/image01.png"
                  alt="AI ALLY Logo"
                  style={{
                    height: '24px',
                    width: 'auto',
                    objectFit: 'contain'
                  }}
                />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default ForgotPassword;

