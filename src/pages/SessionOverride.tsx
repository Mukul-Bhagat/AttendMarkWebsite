import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import api from '../api';
import GoogleMapPicker from '../components/GoogleMapPicker';
import ModeSelector from '../components/ModeSelector';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ModeBadge from '../components/ModeBadge';
import Toast from '../components/Toast';
import { ISession } from '../types';
import { appLogger } from '../shared/logger';
import { normalizeSessionMode, type SessionMode } from '../utils/sessionMode';

const SessionOverride: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: paramId } = useParams<{ id: string }>();

  const sessionId = (paramId || '').includes('_') ? (paramId || '').split('_')[0] : paramId;

  const [session, setSession] = useState<ISession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [initialMode, setInitialMode] = useState<SessionMode>('PHYSICAL');

  const [selectedCoordinates, setSelectedCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [formData, setFormData] = useState({
    mode: 'PHYSICAL' as SessionMode,
    startTime: '',
    endTime: '',
    meetingLink: '',
    locationLabel: '',
    radius: 100,
    reason: '',
  });

  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        setError('Invalid session ID.');
        setIsLoading(false);
        return;
      }

      try {
        const query = new URLSearchParams(location.search);
        const dateParam = query.get('date');
        const url = dateParam
          ? `/api/sessions/${sessionId}/details?date=${dateParam}`
          : `/api/sessions/${sessionId}`;

        const { data } = await api.get(url);
        const sessionData: ISession = data.session || data;

        const mode = normalizeSessionMode(sessionData.sessionType || sessionData.locationType);
        setSession(sessionData);
        setInitialMode(mode);

        setFormData({
          mode,
          startTime: sessionData.startTime || '',
          endTime: sessionData.endTime || '',
          meetingLink: sessionData.virtualLocation || '',
          locationLabel: sessionData.physicalLocation || '',
          radius: sessionData.radius || 100,
          reason: '',
        });

        if (sessionData.location?.geolocation?.latitude && sessionData.location?.geolocation?.longitude) {
          setSelectedCoordinates({
            latitude: sessionData.location.geolocation.latitude,
            longitude: sessionData.location.geolocation.longitude,
          });
        } else if (sessionData.geolocation?.latitude && sessionData.geolocation?.longitude) {
          setSelectedCoordinates({
            latitude: sessionData.geolocation.latitude,
            longitude: sessionData.geolocation.longitude,
          });
        }
      } catch (err: any) {
        appLogger.error('Failed to load session', err);
        setError(err?.response?.data?.message || 'Failed to load session.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, location.search]);

  const validateForm = () => {
    if (!formData.startTime || !formData.endTime) {
      setError('Start and end time are required.');
      return false;
    }
    if (formData.startTime >= formData.endTime) {
      setError('End time must be after start time.');
      return false;
    }
    if ((formData.mode === 'PHYSICAL' || formData.mode === 'HYBRID') && (!selectedCoordinates || !formData.radius)) {
      setError('Physical sessions require location and radius.');
      return false;
    }
    if (!formData.reason.trim() || formData.reason.trim().length < 3) {
      setError('Override reason is required.');
      return false;
    }
    return true;
  };

  const submitOverride = async () => {
    if (!sessionId) return;

    setIsSubmitting(true);
    setError('');

    try {
      const patch: Record<string, any> = {
        mode: formData.mode,
        startTime: formData.startTime,
        endTime: formData.endTime,
      };

      if (formData.mode === 'PHYSICAL' || formData.mode === 'HYBRID') {
        patch.physicalPolicy = {
          radiusMeters: formData.radius,
          center: selectedCoordinates || undefined,
          locationLabel: formData.locationLabel || session?.physicalLocation,
        };
      }

      if (formData.mode === 'REMOTE' || formData.mode === 'HYBRID') {
        patch.remotePolicy = {
          meetingLink: formData.meetingLink || undefined,
        };
      }

      await api.patch(`/api/sessions/${sessionId}/override`, {
        reason: formData.reason.trim(),
        patch,
      });

      const classId = typeof session?.classBatchId === 'object'
        ? session?.classBatchId._id
        : session?.classBatchId;

      if (classId) {
        navigate(`/classes/${classId}/sessions?refresh=${Date.now()}`, {
          state: {
            toast: {
              message: `Session updated to ${formData.mode}.`,
              type: 'success',
            },
          },
        });
      } else {
        navigate('/classes', {
          state: {
            toast: {
              message: `Session updated to ${formData.mode}.`,
              type: 'success',
            },
          },
        });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to override session.');
      setToast({ message: err?.response?.data?.message || 'Failed to override session.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!validateForm()) return;

    if (formData.mode !== initialMode) {
      setShowConfirmDialog(true);
      return;
    }

    submitOverride();
  };

  const handleCancelConfirm = () => {
    setFormData((prev) => ({ ...prev, mode: initialMode }));
    setShowConfirmDialog(false);
  };

  const handleCancel = () => {
    const classId = typeof session?.classBatchId === 'object'
      ? session?.classBatchId._id
      : session?.classBatchId;
    if (classId) {
      navigate(`/classes/${classId}/sessions`);
    } else {
      navigate('/classes');
    }
  };

  if (isLoading) {
    return (
      <div className="relative flex min-h-screen w-full flex-col p-4 sm:p-6 lg:p-8 bg-background-light dark:bg-background-dark font-display">
        <div className="mx-auto flex w-full max-w-4xl flex-col">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-8 w-8 text-[#f04129] mb-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
              </svg>
              <p className="text-[#8a7b60] dark:text-gray-400">Loading session...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col p-4 sm:p-6 lg:p-8 bg-background-light dark:bg-background-dark font-display">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="mx-auto flex w-full max-w-4xl flex-col">
        <div className="mb-8">
          <Link
            to="#"
            onClick={(event) => {
              event.preventDefault();
              handleCancel();
            }}
            className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#f5f3f0] dark:bg-slate-800 text-[#181511] dark:text-gray-200 gap-2 text-sm font-bold leading-normal tracking-[0.015em] border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="truncate">Back to Sessions</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-3xl font-black leading-tight tracking-[-0.033em] text-[#181511] dark:text-white sm:text-4xl">
              Override Session
            </p>
            <ModeBadge mode={formData.mode} size="md" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Update this session only. Other sessions remain unchanged.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            <span className="material-symbols-outlined mr-2 text-xl">error</span>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col space-y-6">
          <div className="flex flex-col gap-6 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-[#f04129]">hub</span>
              <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Mode</h2>
            </div>
            <ModeSelector value={formData.mode} onChange={(mode) => setFormData((prev) => ({ ...prev, mode }))} />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label className="flex flex-col rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Start Time</p>
              <input
                className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                type="time"
                value={formData.startTime}
                onChange={(event) => setFormData((prev) => ({ ...prev, startTime: event.target.value }))}
                required
              />
            </label>
            <label className="flex flex-col rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">End Time</p>
              <input
                className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                type="time"
                value={formData.endTime}
                onChange={(event) => setFormData((prev) => ({ ...prev, endTime: event.target.value }))}
                required
              />
            </label>
          </div>

          {(formData.mode === 'PHYSICAL' || formData.mode === 'HYBRID') && (
            <div className="flex flex-col gap-6 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-[#f04129]">pin_drop</span>
                <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Location Details</h2>
              </div>

              <GoogleMapPicker
                initialCoordinates={selectedCoordinates || undefined}
                initialRadius={formData.radius}
                onConfirm={(data) => {
                  setSelectedCoordinates({ latitude: data.latitude, longitude: data.longitude });
                  setFormData((prev) => ({ ...prev, radius: data.radius }));
                }}
                isOpen={showMapPicker}
                onClose={() => setShowMapPicker(false)}
              />

              <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="bg-gray-50 dark:bg-gray-900 p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
                  <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-full shadow-sm">
                    <span className="material-symbols-outlined text-3xl text-[#f04129]">location_on</span>
                  </div>

                  {selectedCoordinates ? (
                    <div className="mb-4">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Location Selected</p>
                      <p className="text-sm font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                        {selectedCoordinates.latitude.toFixed(6)}, {selectedCoordinates.longitude.toFixed(6)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
                      Select a location to enable physical attendance.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#f04129] hover:bg-[#d63a25] text-white rounded-lg font-medium transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined">map</span>
                    {selectedCoordinates ? 'Change Location' : 'Select on Map'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col">
                  <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Location Label</p>
                  <input
                    className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    type="text"
                    value={formData.locationLabel}
                    onChange={(event) => setFormData((prev) => ({ ...prev, locationLabel: event.target.value }))}
                    placeholder="e.g., Main Campus"
                  />
                </label>
                <label className="flex flex-col">
                  <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Radius (meters)</p>
                  <input
                    className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    type="number"
                    min={1}
                    value={formData.radius}
                    onChange={(event) => setFormData((prev) => ({ ...prev, radius: Number(event.target.value) }))}
                  />
                </label>
              </div>
            </div>
          )}

          {(formData.mode === 'REMOTE' || formData.mode === 'HYBRID') && (
            <div className="flex flex-col gap-6 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-[#f04129]">videocam</span>
                <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Virtual Meeting Link</h2>
              </div>
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Meeting URL</p>
                <input
                  className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] placeholder:text-[#8a7b60] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-400"
                  type="url"
                  value={formData.meetingLink}
                  onChange={(event) => setFormData((prev) => ({ ...prev, meetingLink: event.target.value }))}
                  placeholder="https://meet.google.com/..."
                />
              </label>
            </div>
          )}

          <div className="flex flex-col gap-6 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-[#f04129]">edit</span>
              <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Override Reason</h2>
            </div>
            <textarea
              className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] placeholder:text-[#8a7b60] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-400"
              rows={3}
              value={formData.reason}
              onChange={(event) => setFormData((prev) => ({ ...prev, reason: event.target.value }))}
              placeholder="Why are you overriding this session?"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg px-6 py-3 font-semibold text-[#5c5445] transition-colors duration-200 hover:bg-[#f5f3f0] dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-[#f04129] px-8 py-3 font-semibold text-white transition-all duration-200 hover:from-orange-600 hover:to-[#d63a25] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Override'}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={showConfirmDialog}
        title="Confirm Session Mode Change"
        description={(
          <div className="space-y-3">
            <p>You are changing the mode for this session only.</p>
            <div>
              <p>Current mode: <strong>{initialMode}</strong></p>
              <p>New mode: <strong>{formData.mode}</strong></p>
            </div>
            <div>
              <p>This will:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Affect only this session.</li>
                <li>Not change other sessions.</li>
                <li>Modify attendance behavior for this session only.</li>
              </ul>
            </div>
            <p>Continue?</p>
          </div>
        )}
        confirmLabel="Confirm Override"
        cancelLabel="Cancel"
        onCancel={handleCancelConfirm}
        onConfirm={() => {
          setShowConfirmDialog(false);
          submitOverride();
        }}
        isLoading={isSubmitting}
      />
    </div>
  );
};

export default SessionOverride;
