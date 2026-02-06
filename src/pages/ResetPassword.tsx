import React, { useState } from 'react';
import api from '../api';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';

const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Get token from URL query params (e.g. ?token=abc)
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setIsSubmitting(false);
      return;
    }

    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      setIsSubmitting(false);
      return;
    }

    try {
      // Send token in body, not as path param
      const { data } = await api.post('/api/auth/reset-password', { token, newPassword });

      setIsSubmitting(false);
      setMessage(data.msg + ' Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err: any) {
      // CRITICAL: Always stop loading state FIRST, before any error handling
      setIsSubmitting(false);

      if (err.response?.data?.errors) {
        const errorMessages = err.response.data.errors.map((e: any) => e.msg).join(', ');
        setError(errorMessages);
      } else {
        setError(err.response?.data?.msg || 'An error occurred');
      }
    }
  };

  return (
    <div className="form-container" style={{ maxWidth: '500px' }}>
      <h1>Set New Password</h1>
      <p style={{ color: '#6b7280', marginBottom: '24px', textAlign: 'center' }}>
        Enter your new password below.
      </p>

      {message && (
        <div className="success-message" style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#d1fae5', border: '1px solid #10b981', borderRadius: '6px', color: '#065f46' }}>
          {message}
        </div>
      )}
      {error && (
        <div className="error-message" style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626' }}>
          {error}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label>New Password *</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (error) setError('');
              }}
              minLength={6}
              required
              disabled={isSubmitting || !!message}
              autoComplete="new-password"
              placeholder="Minimum 6 characters"
              style={{ paddingRight: '48px' }}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                {showNewPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>
        <div className="form-group">
          <label>Confirm New Password *</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (error) setError('');
              }}
              required
              disabled={isSubmitting || !!message}
              autoComplete="new-password"
              style={{ paddingRight: '48px' }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                {showConfirmPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>
        <button type="submit" disabled={isSubmitting || !!message} style={{ width: '100%' }}>
          {isSubmitting ? 'Resetting Password...' : message ? 'Password Reset!' : 'Set New Password'}
        </button>
      </form>
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.95rem' }}>
          Back to Login
        </Link>
      </div>
    </div>
  );
};

export default ResetPassword;

