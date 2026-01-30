import React, { useState } from 'react';
import { X } from 'lucide-react';

export type ResetDeviceMode = 'generate' | 'assign';

export interface ResetDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetName: string;
  targetLabel: 'user' | 'staff';
  onSubmit: (payload: { type: 'generate' } | { type: 'assign'; newPassword: string }) => Promise<void>;
  isSubmitting?: boolean;
}

const ResetDeviceModal: React.FC<ResetDeviceModalProps> = ({
  isOpen,
  onClose,
  targetName,
  targetLabel,
  onSubmit,
  isSubmitting = false,
}) => {
  const [mode, setMode] = useState<ResetDeviceMode>('generate');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ newPassword?: string; confirm?: string }>({});

  const label = targetLabel === 'user' ? 'user' : 'staff member';

  const handleClose = () => {
    if (!isSubmitting) {
      setMode('generate');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
      onClose();
    }
  };

  const validate = (): boolean => {
    const next: { newPassword?: string; confirm?: string } = {};
    if (mode === 'assign') {
      if (!newPassword.trim()) {
        next.newPassword = 'Password is required';
      } else if (newPassword.length < 6) {
        next.newPassword = 'Password must be at least 6 characters';
      }
      if (newPassword !== confirmPassword) {
        next.confirm = 'Passwords do not match';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'assign' && !validate()) return;

    try {
      if (mode === 'generate') {
        await onSubmit({ type: 'generate' });
      } else {
        await onSubmit({ type: 'assign', newPassword: newPassword.trim() });
      }
      handleClose();
    } catch {
      // Parent handles error message
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reset Device ID</h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          This will reset {targetName}&apos;s device ID and set a new password. They will be able to log in from a new
          device or browser and mark attendance. Previous attendance and account data are preserved.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="resetMode"
                checked={mode === 'generate'}
                onChange={() => setMode('generate')}
                className="text-red-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Generate a random password and email it to the {label}.
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="resetMode"
                checked={mode === 'assign'}
                onChange={() => setMode('assign')}
                className="text-red-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Set a custom password.</span>
            </label>
          </div>

          {mode === 'assign' && (
            <div className="space-y-3 pl-6 border-l-2 border-gray-200 dark:border-slate-600">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (errors.newPassword) setErrors((prev) => ({ ...prev, newPassword: undefined }));
                  }}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  minLength={6}
                  autoComplete="new-password"
                />
                {errors.newPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.newPassword}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirm) setErrors((prev) => ({ ...prev, confirm: undefined }));
                  }}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  autoComplete="new-password"
                />
                {errors.confirm && <p className="text-red-500 text-xs mt-1">{errors.confirm}</p>}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Resetting...
                </>
              ) : (
                'Reset device'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetDeviceModal;
