import React, { useState } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

const ForceResetPassword: React.FC = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refetchUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      setIsSubmitting(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      setIsSubmitting(false);
      return;
    }

    try {
      // Call the API endpoint to reset password
      const { data } = await api.post('/api/auth/force-reset-password', { oldPassword, newPassword });
      
      setMessage(data.msg || 'Password reset successfully!');
      
      // Refresh user data - this will update mustResetPassword to false
      // The modal will automatically close because App.tsx checks user?.mustResetPassword
      await refetchUser();
      
      // Clear form after successful reset
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.msg || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div 
        className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
            Reset Your Password
          </h1>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            This is your first login. You must reset your temporary password.
          </p>
        </div>
        
        {message && (
          <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined">check_circle</span>
              <p className="font-medium">{message}</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined">error</span>
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
              Old (Temporary) Password
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              required
              disabled={!!message || isSubmitting}
              placeholder="Enter your temporary password"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              className="w-full px-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              required
              disabled={!!message || isSubmitting}
              placeholder="Enter your new password"
            />
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
              Minimum 6 characters
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              required
              disabled={!!message || isSubmitting}
              placeholder="Confirm your new password"
            />
          </div>
          
          <button
            type="submit"
            className="w-full px-6 py-3 text-base font-bold text-white bg-primary hover:bg-[#d63a25] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={!!message || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Resetting Password...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">lock_reset</span>
                <span>Set New Password</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForceResetPassword;
