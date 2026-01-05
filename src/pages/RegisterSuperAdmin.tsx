import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Toast from '../components/Toast';

// This is the component for our /register route
const RegisterSuperAdmin: React.FC = () => {
  const [formData, setFormData] = useState({
    organizationName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const orgNameInputRef = useRef<HTMLInputElement>(null);

  const { organizationName, firstName, lastName, email, phone, password } = formData;

  // Auto-focus first input on mount
  useEffect(() => {
    orgNameInputRef.current?.focus();
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsSubmitting(true);

    try {
      // Get password from formData
      const formPassword = formData.password;

      // Validate password length
      if (!formPassword || formPassword.length < 6) {
        const errorMessage = 'Password must be at least 6 characters long.';
        setError(errorMessage);
        setToast({
          message: errorMessage,
          type: 'error',
        });
        setIsSubmitting(false);
        return;
      }

      // Prepare request data with password
      const requestData = {
        organizationName: formData.organizationName,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formPassword, // Send password to backend
      };

      // Send registration request
      await api.post('/api/auth/register-super-admin', requestData);

      // Show success message and toast
      const successMessage = 'Registration successful! You can now login with your password.';
      setMessage(successMessage);
      setToast({
        message: successMessage,
        type: 'success',
      });
      
      // Clear the form
      setFormData({
        organizationName: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
      });
      
      // Ensure no auth tokens exist (clean state)
      // This prevents any automatic auth checks from triggering
      localStorage.removeItem('token');
      
      // Redirect to login after 2-3 seconds
      // Use window.location to ensure a clean page load without triggering React Router auth checks
      setTimeout(() => {
        window.location.href = '/login';
      }, 2500);
    } catch (err: any) {
      // Clear any previous success messages
      setMessage('');

      // Extract error message
      let errorMessage = 'Registration failed. Please try again.';

      if (err.response) {
        // Server responded with an error status
        const { status, data } = err.response;

        if (data) {
          // Handle express-validator errors (array format) - 400 Bad Request
          if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
            errorMessage = data.errors.map((e: any) => e.msg || e.message || 'Validation error').join(', ');
          } 
          // Handle custom error messages (string format)
          else if (data.msg) {
            errorMessage = data.msg;
          } 
          // Handle error object with message property
          else if (data.message) {
            errorMessage = data.message;
          }
          // Handle error object with error property
          else if (data.error) {
            errorMessage = typeof data.error === 'string' ? data.error : data.error.message || 'Registration error';
          }
        } else {
          // No data in response, use status-based message
          if (status === 400) {
            errorMessage = 'Invalid registration data. Please check your information and try again.';
          } else if (status === 409) {
            errorMessage = 'This organization or email already exists. Please use different information.';
          } else if (status >= 500) {
            errorMessage = 'Server error. Please try again later.';
          } else {
            errorMessage = `Registration failed (${status}). Please try again.`;
          }
        }
      } else if (err.request) {
        // Request was made but no response received (network error)
        errorMessage = 'Network error. Please check your connection and try again.';
      } else {
        // Error setting up the request
        errorMessage = err.message || 'An unexpected error occurred. Please try again.';
      }

      // Set the error message in state (for inline display)
      setError(errorMessage);

      // Show toast notification for error
      setToast({
        message: errorMessage,
        type: 'error',
      });

      // Log error for debugging (only in development)
      if (import.meta.env.DEV) {
        console.error('Registration error:', err);
      }
    } finally {
      // CRITICAL: Always reset loading state using finally block
      // This ensures the UI never gets stuck, even if error handling fails
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col group/design-root">
      <div className="flex-1">
        <div className="grid min-h-screen lg:grid-cols-2">
          <div className="hidden lg:flex flex-col items-center justify-center bg-[#111827] text-white p-12">
            <Link to="/landing" className="flex flex-col items-center justify-center text-center max-w-md cursor-pointer hover:opacity-80 transition-opacity">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-5xl">checklist</span>
                <h2 className="text-4xl font-bold tracking-tighter">AttendMark</h2>
              </div>
              <p className="mt-4 text-lg text-gray-300">Seamless Attendance Tracking for Modern Organizations.</p>
            </Link>
          </div>

          <div className="flex w-full items-center justify-center bg-white dark:bg-zinc-900 p-6 sm:p-8 lg:p-12">
            <div className="w-full max-w-md space-y-6">
              <div className="space-y-2 text-left">
                <h1 className="text-[#181511] dark:text-gray-100 text-3xl sm:text-4xl font-black leading-tight tracking-[-0.033em]">Create your account</h1>
                <p className="text-gray-500 dark:text-gray-400">Enter your details to get started.</p>
              </div>

              {/* Success Message */}
              {message && (
                <div className="flex items-center gap-3 rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                  <span className="material-symbols-outlined text-green-500" style={{ fontSize: '24px' }}>check_circle</span>
                  <p className="text-sm font-medium text-green-500">{message}</p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
                  <span className="material-symbols-outlined text-red-500" style={{ fontSize: '24px' }}>error</span>
                  <p className="text-sm font-medium text-red-500">{error}</p>
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-4">
                <div className="flex flex-col">
                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal pb-2">Organization Name</p>
                    <input
                      ref={orgNameInputRef}
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-gray-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50 border border-[#e6e2db] dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-[#8a7b60] dark:placeholder:text-gray-500 p-[15px] text-base font-normal leading-normal transition-shadow"
                      placeholder="Enter your organization's name"
                      type="text"
                      name="organizationName"
                      value={organizationName}
                      onChange={onChange}
                      required
                      autoComplete="organization"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal pb-2">First Name</p>
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-gray-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50 border border-[#e6e2db] dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-[#8a7b60] dark:placeholder:text-gray-500 p-[15px] text-base font-normal leading-normal transition-shadow"
                      placeholder="Enter your first name"
                      type="text"
                      name="firstName"
                      value={firstName}
                      onChange={onChange}
                      required
                    />
                  </label>

                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal pb-2">Last Name</p>
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-gray-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50 border border-[#e6e2db] dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-[#8a7b60] dark:placeholder:text-gray-500 p-[15px] text-base font-normal leading-normal transition-shadow"
                      placeholder="Enter your last name"
                      type="text"
                      name="lastName"
                      value={lastName}
                      onChange={onChange}
                      required
                    />
                  </label>
                </div>

                <div className="flex flex-col">
                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal pb-2">Email</p>
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-gray-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50 border border-[#e6e2db] dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-[#8a7b60] dark:placeholder:text-gray-500 p-[15px] text-base font-normal leading-normal transition-shadow"
                      placeholder="Enter your email address"
                      type="email"
                      name="email"
                      value={email}
                      onChange={onChange}
                      required
                      autoComplete="email"
                    />
                  </label>
                </div>

                <div className="flex flex-col">
                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal pb-2">
                      Phone <span className="text-gray-400 dark:text-gray-500">(optional)</span>
                    </p>
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-gray-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50 border border-[#e6e2db] dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-[#8a7b60] dark:placeholder:text-gray-500 p-[15px] text-base font-normal leading-normal transition-shadow"
                      placeholder="Enter your phone number"
                      type="text"
                      name="phone"
                      value={phone}
                      onChange={onChange}
                    />
                  </label>
                </div>

                <div className="flex flex-col">
                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal pb-2">Password</p>
                    <input
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-gray-100 focus:outline-0 focus:ring-2 focus:ring-primary/50 dark:focus:ring-primary/50 border border-[#e6e2db] dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-[#8a7b60] dark:placeholder:text-gray-500 p-[15px] text-base font-normal leading-normal transition-shadow"
                      placeholder="Enter your password (min. 6 characters)"
                      type="password"
                      name="password"
                      value={password}
                      onChange={onChange}
                      required
                      autoComplete="new-password"
                      minLength={6}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-bold text-white shadow-sm transition-all hover:bg-[#d63a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? 'Registering...' : 'Register'}
                </button>
              </form>

              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Login here</Link>
              </div>
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

export default RegisterSuperAdmin;

