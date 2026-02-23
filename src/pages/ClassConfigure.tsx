
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { v4 as uuidv4 } from 'uuid';

import api from '../api';
import GoogleMapPicker from '../components/GoogleMapPicker';
import AddUsersModal from '../components/AddUsersModal';
import ModeSelector from '../components/ModeSelector';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ModeBadge from '../components/ModeBadge';
import Toast from '../components/Toast';
import { toISTDateString } from '../utils/time';
import { normalizeSessionMode, type SessionMode } from '../utils/sessionMode';
import { appLogger } from '../shared/logger';

import 'react-day-picker/dist/style.css';

interface ClassBatchSummary {
  _id: string;
  name: string;
  description?: string;
  configRevision?: number;
}

type Frequency = 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM_DATES';

interface ConfigVersionPayload {
  effectiveFromKey: string;
  scheduleRule: {
    frequency: Frequency;
    startDateKey: string;
    endDateKey?: string;
    weeklyDays?: number[];
    monthlyDay?: number;
    customDates?: string[];
    startTime: string;
    endTime: string;
    timezone?: string;
  };
  defaults: {
    mode: SessionMode;
    physicalPolicy?: {
      radiusMeters?: number;
      center?: { latitude: number; longitude: number };
      locationLabel?: string;
    };
    remotePolicy?: {
      meetingLink?: string;
    };
    hybridPolicy?: {
      defaultParticipantMode?: 'PHYSICAL' | 'REMOTE';
      physicalPolicy?: {
        radiusMeters?: number;
        center?: { latitude: number; longitude: number };
        locationLabel?: string;
      };
      remotePolicy?: {
        meetingLink?: string;
      };
    };
  };
}

interface EnrollmentUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  preferredMode: 'PHYSICAL' | 'REMOTE';
  status: string;
  joinedAt?: string;
  removedAt?: string;
}

interface OrgUser {
  _id: string;
  email: string;
  role: string;
  profile: {
    firstName: string;
    lastName: string;
  };
}

const weekDays = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

const ClassConfigure: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [classBatch, setClassBatch] = useState<ClassBatchSummary | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentUser[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    effectiveFrom: '',
    frequency: 'ONE_TIME' as Frequency,
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    weeklyDays: [] as number[],
    monthlyDay: '',
    customDates: [] as string[],
    mode: 'PHYSICAL' as SessionMode,
    meetingLink: '',
    locationLabel: '',
    radius: 100,
    hybridDefaultMode: 'PHYSICAL' as 'PHYSICAL' | 'REMOTE',
  });

  const [selectedCoordinates, setSelectedCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRosterUpdating, setIsRosterUpdating] = useState(false);
  const [error, setError] = useState('');
  const [initialMode, setInitialMode] = useState<SessionMode>('PHYSICAL');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const selectedDateObjects = useMemo(
    () => formData.customDates.map((dateKey) => new Date(`${dateKey}T00:00:00Z`)),
    [formData.customDates]
  );

  const fetchEnrollments = async (classId: string) => {
    try {
      const { data } = await api.get(`/api/classes/${classId}/enrollments`);
      setEnrollments(data.enrollments || []);
    } catch (err) {
      appLogger.error('Failed to fetch enrollments', err);
    }
  };

  useEffect(() => {
    const fetchConfiguration = async () => {
      if (!id) {
        setError('Invalid class ID');
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await api.get(`/api/classes/${id}/configuration`);
        const classData = data.classBatch as ClassBatchSummary;
        const configData = data.configVersion as ConfigVersionPayload | null;

        setClassBatch(classData);
        const todayKey = toISTDateString(new Date());

        if (configData) {
          const mode = normalizeSessionMode(configData.defaults?.mode || 'PHYSICAL');
          const schedule = configData.scheduleRule;

          const meetingLink = mode === 'REMOTE'
            ? configData.defaults?.remotePolicy?.meetingLink || ''
            : mode === 'HYBRID'
              ? configData.defaults?.hybridPolicy?.remotePolicy?.meetingLink || ''
              : '';

          const physicalPolicy = mode === 'HYBRID'
            ? configData.defaults?.hybridPolicy?.physicalPolicy
            : configData.defaults?.physicalPolicy;

          setSelectedCoordinates(
            physicalPolicy?.center
              ? { latitude: physicalPolicy.center.latitude, longitude: physicalPolicy.center.longitude }
              : null
          );

          setFormData({
            name: classData.name || '',
            description: classData.description || '',
            effectiveFrom: configData.effectiveFromKey || todayKey,
            frequency: schedule.frequency,
            startDate: schedule.startDateKey,
            endDate: schedule.endDateKey || '',
            startTime: schedule.startTime || '',
            endTime: schedule.endTime || '',
            weeklyDays: schedule.weeklyDays || [],
            monthlyDay: schedule.monthlyDay ? String(schedule.monthlyDay) : '',
            customDates: schedule.customDates || [],
            mode,
            meetingLink,
            locationLabel: physicalPolicy?.locationLabel || '',
            radius: physicalPolicy?.radiusMeters || 100,
            hybridDefaultMode: configData.defaults?.hybridPolicy?.defaultParticipantMode || 'PHYSICAL',
          });

          setInitialMode(mode);
        } else {
          setFormData((prev) => ({
            ...prev,
            name: classData.name || '',
            description: classData.description || '',
            effectiveFrom: todayKey,
            startDate: todayKey,
          }));
          setInitialMode('PHYSICAL');
        }

        await fetchEnrollments(id);
      } catch (err: any) {
        appLogger.error('Failed to load class configuration', err);
        setError(err?.response?.data?.message || 'Failed to load class configuration');
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfiguration();
  }, [id]);

  const handleToggleWeekday = (dayValue: number) => {
    setFormData((prev) => {
      const exists = prev.weeklyDays.includes(dayValue);
      const nextDays = exists
        ? prev.weeklyDays.filter((d) => d !== dayValue)
        : [...prev.weeklyDays, dayValue];
      return { ...prev, weeklyDays: nextDays };
    });
  };

  const handleCustomDateChange = (dates: Date[] | undefined) => {
    if (!dates) {
      setFormData((prev) => ({ ...prev, customDates: [] }));
      return;
    }

    const uniqueDates = Array.from(
      new Set(
        dates
          .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
          .map((date) => toISTDateString(date))
      )
    ).sort();

    setFormData((prev) => ({ ...prev, customDates: uniqueDates }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Class name is required.');
      return false;
    }
    if (!formData.effectiveFrom) {
      setError('Effective date is required.');
      return false;
    }
    if (!formData.startDate) {
      setError('Start date is required.');
      return false;
    }
    if (!formData.startTime || !formData.endTime) {
      setError('Start and end time are required.');
      return false;
    }
    if (formData.frequency === 'WEEKLY' && formData.weeklyDays.length === 0) {
      setError('Select at least one weekly day.');
      return false;
    }
    if (formData.frequency === 'MONTHLY' && !formData.monthlyDay) {
      setError('Monthly day is required.');
      return false;
    }
    if (formData.frequency === 'CUSTOM_DATES' && formData.customDates.length === 0) {
      setError('Select at least one custom date.');
      return false;
    }
    if ((formData.mode === 'PHYSICAL' || formData.mode === 'HYBRID') && (!selectedCoordinates || !formData.radius)) {
      setError('Physical sessions require location and radius.');
      return false;
    }
    return true;
  };

  const buildScheduleRule = () => {
    const normalizedCustomDates = formData.customDates.slice().sort();
    const startDateKey = formData.frequency === 'CUSTOM_DATES'
      ? normalizedCustomDates[0] || formData.startDate
      : formData.startDate;

    return {
      frequency: formData.frequency,
      startDateKey,
      endDateKey: formData.endDate || undefined,
      weeklyDays: formData.frequency === 'WEEKLY' ? formData.weeklyDays : undefined,
      monthlyDay: formData.frequency === 'MONTHLY' && formData.monthlyDay
        ? Number(formData.monthlyDay)
        : undefined,
      customDates: formData.frequency === 'CUSTOM_DATES' ? normalizedCustomDates : undefined,
      startTime: formData.startTime,
      endTime: formData.endTime,
      timezone: 'Asia/Kolkata',
    };
  };

  const buildDefaults = () => {
    const locationLabel = formData.locationLabel || classBatch?.name || 'Class Location';

    if (formData.mode === 'REMOTE') {
      return {
        mode: 'REMOTE' as SessionMode,
        remotePolicy: {
          meetingLink: formData.meetingLink || undefined,
          geoRequired: false,
        },
      };
    }

    if (formData.mode === 'HYBRID') {
      return {
        mode: 'HYBRID' as SessionMode,
        hybridPolicy: {
          allowPhysical: true,
          allowRemote: true,
          defaultParticipantMode: formData.hybridDefaultMode,
          physicalPolicy: {
            mapRequired: true,
            geoRequired: true,
            radiusMeters: formData.radius,
            center: selectedCoordinates || undefined,
            locationLabel,
          },
          remotePolicy: {
            geoRequired: false,
            meetingLink: formData.meetingLink || undefined,
          },
        },
      };
    }

    return {
      mode: 'PHYSICAL' as SessionMode,
      physicalPolicy: {
        mapRequired: true,
        geoRequired: true,
        radiusMeters: formData.radius,
        center: selectedCoordinates || undefined,
        locationLabel,
      },
    };
  };

  const submitConfiguration = async () => {
    if (!id) return;

    setIsSubmitting(true);
    setError('');

    try {
      if (classBatch && (formData.name !== classBatch.name || formData.description !== (classBatch.description || ''))) {
        await api.put(`/api/classes/${id}`, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        });
      }

      const payload = {
        effectiveFrom: formData.effectiveFrom,
        expectedRevision: classBatch?.configRevision ?? 0,
        scheduleRule: buildScheduleRule(),
        defaults: buildDefaults(),
      };

      const idempotencyKey = uuidv4();

      await api.put(`/api/classes/${id}/configure`, payload, {
        headers: {
          'Idempotency-Key': idempotencyKey,
          ...(classBatch?.configRevision !== undefined
            ? { 'If-Match': String(classBatch.configRevision) }
            : {}),
        },
      });

      setInitialMode(formData.mode);

      navigate(`/classes/${id}/sessions?refresh=${Date.now()}`, {
        state: {
          toast: {
            message: `Class updated. Future sessions converted to ${formData.mode}.`,
            type: 'success',
          },
        },
      });
    } catch (err: any) {
      appLogger.error('Failed to configure class', err);
      setError(err?.response?.data?.message || 'Failed to configure class.');
      setToast({
        message: err?.response?.data?.message || 'Failed to configure class.',
        type: 'error',
      });
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

    submitConfiguration();
  };

  const handleConfirmCancel = () => {
    setFormData((prev) => ({ ...prev, mode: initialMode }));
    setShowConfirmDialog(false);
  };

  const handleAddUsers = async (users: OrgUser[]) => {
    if (!id) return;
    const existingIds = new Set(enrollments.map((enrollment) => enrollment.userId));
    const newUsers = users.filter((user) => !existingIds.has(user._id));

    if (newUsers.length === 0) {
      setToast({ message: 'No new users selected.', type: 'info' });
      return;
    }

    const preferredMode: 'PHYSICAL' | 'REMOTE' = formData.mode === 'REMOTE'
      ? 'REMOTE'
      : formData.mode === 'HYBRID'
        ? formData.hybridDefaultMode
        : 'PHYSICAL';

    setIsRosterUpdating(true);
    try {
      await api.post(`/api/classes/${id}/add-users`, {
        users: newUsers.map((user) => ({ userId: user._id, preferredMode })),
      });
      await fetchEnrollments(id);
      setToast({ message: `${newUsers.length} user(s) added to class.`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to add users.', type: 'error' });
    } finally {
      setIsRosterUpdating(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!id) return;
    setIsRosterUpdating(true);

    try {
      await api.post(`/api/classes/${id}/remove-users`, {
        users: [{ userId }],
        removedAt: new Date().toISOString(),
      });
      await fetchEnrollments(id);
      setToast({ message: 'User removed from class.', type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to remove user.', type: 'error' });
    } finally {
      setIsRosterUpdating(false);
    }
  };

  const handleUpdatePreferredMode = async (userId: string, preferredMode: 'PHYSICAL' | 'REMOTE') => {
    if (!id) return;
    setIsRosterUpdating(true);

    try {
      await api.post(`/api/classes/${id}/add-users`, {
        users: [{ userId, preferredMode }],
      });
      await fetchEnrollments(id);
      setToast({ message: 'Participant mode updated.', type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to update participant mode.', type: 'error' });
    } finally {
      setIsRosterUpdating(false);
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
              <p className="text-[#8a7b60] dark:text-gray-400">Loading configuration...</p>
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

      <div className="mx-auto flex w-full max-w-5xl flex-col">
        <div className="mb-8">
          <Link
            to="/classes"
            className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#f5f3f0] dark:bg-slate-800 text-[#181511] dark:text-gray-200 gap-2 text-sm font-bold leading-normal tracking-[0.015em] border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="truncate">Back to Classes</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-3xl font-black leading-tight tracking-[-0.033em] text-[#181511] dark:text-white sm:text-4xl">
              Configure Class
            </p>
            <ModeBadge mode={formData.mode} size="md" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Update class configuration and future sessions. Past sessions remain unchanged.
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
              <span className="material-symbols-outlined text-2xl text-[#f04129]">settings</span>
              <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Class Details</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Class Name</p>
                <input
                  className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] placeholder:text-[#8a7b60] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-400"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Effective From</p>
                <input
                  className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  name="effectiveFrom"
                  type="date"
                  value={formData.effectiveFrom}
                  onChange={(event) => setFormData((prev) => ({ ...prev, effectiveFrom: event.target.value }))}
                  required
                />
              </label>
            </div>
            <label className="flex flex-col">
              <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Description</p>
              <textarea
                className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] placeholder:text-[#8a7b60] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-400"
                name="description"
                rows={3}
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Add a description for this class"
              />
            </label>
          </div>

          <div className="flex flex-col gap-6 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-[#f04129]">calendar_month</span>
              <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Schedule</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Frequency</p>
                <select
                  className="form-select w-full appearance-none rounded-lg border border-[#e6e2db] bg-white p-3 text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  value={formData.frequency}
                  onChange={(event) => setFormData((prev) => ({ ...prev, frequency: event.target.value as Frequency }))}
                >
                  <option value="ONE_TIME">One Time</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="CUSTOM_DATES">Custom Dates</option>
                </select>
              </label>
              {formData.frequency === 'MONTHLY' && (
                <label className="flex flex-col">
                  <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Monthly Day</p>
                  <input
                    className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    type="number"
                    min={1}
                    max={31}
                    value={formData.monthlyDay}
                    onChange={(event) => setFormData((prev) => ({ ...prev, monthlyDay: event.target.value }))}
                  />
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Start Date</p>
                <input
                  className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(event) => setFormData((prev) => ({ ...prev, startDate: event.target.value }))}
                  required
                />
              </label>
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">End Date</p>
                <input
                  className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(event) => setFormData((prev) => ({ ...prev, endDate: event.target.value }))}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Start Time</p>
                <input
                  className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  name="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(event) => setFormData((prev) => ({ ...prev, startTime: event.target.value }))}
                  required
                />
              </label>
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">End Time</p>
                <input
                  className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  name="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(event) => setFormData((prev) => ({ ...prev, endTime: event.target.value }))}
                  required
                />
              </label>
            </div>

            {formData.frequency === 'WEEKLY' && (
              <div>
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Weekly Days</p>
                <div className="flex flex-wrap gap-2">
                  {weekDays.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handleToggleWeekday(day.value)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${formData.weeklyDays.includes(day.value)
                        ? 'bg-[#f04129] text-white'
                        : 'bg-[#f5f3f0] text-[#5c5445] dark:bg-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formData.frequency === 'CUSTOM_DATES' && (
              <div>
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Custom Dates</p>
                <div className="rounded-lg border border-[#e6e2db] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <DayPicker
                    mode="multiple"
                    selected={selectedDateObjects}
                    onSelect={(dates) => handleCustomDateChange(dates as Date[])}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-[#f04129]">hub</span>
              <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Mode</h2>
            </div>
            <ModeSelector value={formData.mode} onChange={(mode) => setFormData((prev) => ({ ...prev, mode }))} />

            {formData.mode === 'HYBRID' && (
              <div className="mt-4">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Default Participant Mode</p>
                <div className="flex gap-3">
                  {(['PHYSICAL', 'REMOTE'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, hybridDefaultMode: mode }))}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold border ${formData.hybridDefaultMode === mode
                        ? 'border-[#f04129] text-[#f04129] bg-red-50 dark:bg-red-900/10'
                        : 'border-[#e6e2db] text-[#5c5445] dark:border-slate-600 dark:text-slate-200'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(formData.mode === 'PHYSICAL' || formData.mode === 'HYBRID') && (
            <div className="flex flex-col gap-6 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-[#f04129]">pin_drop</span>
                  <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Location Details</h2>
                </div>
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
                  name="virtualLocation"
                  type="url"
                  value={formData.meetingLink}
                  onChange={(event) => setFormData((prev) => ({ ...prev, meetingLink: event.target.value }))}
                  placeholder="https://meet.google.com/..."
                />
              </label>
            </div>
          )}

          <div className="flex flex-col gap-6 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-[#f04129]">group</span>
                <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Class Roster</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowUserModal(true)}
                className="flex items-center gap-2 rounded-lg border border-[#f04129] px-4 py-2 text-sm font-semibold text-[#f04129] hover:bg-red-50 dark:hover:bg-[#f04129]/10 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">add_circle</span>
                Add Users
              </button>
            </div>

            <div className="space-y-3">
              {enrollments.length === 0 ? (
                <p className="text-sm text-[#8a7b60] dark:text-slate-400">No users enrolled yet.</p>
              ) : (
                enrollments.map((user) => (
                  <div
                    key={user.userId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e6e2db] p-4 dark:border-slate-700"
                  >
                    <div>
                      <p className="font-semibold text-[#181511] dark:text-white">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {formData.mode === 'HYBRID' ? (
                        <select
                          className="rounded-lg border border-[#e6e2db] bg-white px-3 py-2 text-sm text-[#181511] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          value={user.preferredMode}
                          onChange={(event) => handleUpdatePreferredMode(user.userId, event.target.value as 'PHYSICAL' | 'REMOTE')}
                          disabled={isRosterUpdating}
                        >
                          <option value="PHYSICAL">PHYSICAL</option>
                          <option value="REMOTE">REMOTE</option>
                        </select>
                      ) : (
                        <ModeBadge mode={formData.mode === 'REMOTE' ? 'REMOTE' : 'PHYSICAL'} />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(user.userId)}
                        disabled={isRosterUpdating}
                        className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                        title="Remove user"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Link
              to="/classes"
              className="rounded-lg px-6 py-3 font-semibold text-[#5c5445] transition-colors duration-200 hover:bg-[#f5f3f0] dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-[#f04129] px-8 py-3 font-semibold text-white transition-all duration-200 hover:from-orange-600 hover:to-[#d63a25] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>

        {showUserModal && (
          <AddUsersModal
            onClose={() => setShowUserModal(false)}
            onSave={(users) => handleAddUsers(users as OrgUser[])}
            initialSelectedUsers={[]}
            context="Add Users to Class"
          />
        )}
      </div>

      <ConfirmDialog
        open={showConfirmDialog}
        title="Confirm Class Mode Change"
        description={(
          <div className="space-y-3">
            <p>
              You are changing the class mode from <strong>{initialMode}</strong> to <strong>{formData.mode}</strong>.
            </p>
            <div>
              <p>This will:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Convert all upcoming sessions to {formData.mode}.</li>
                <li>Regenerate future sessions from the effective date.</li>
                <li>Past sessions will remain unchanged.</li>
                <li>Attendance behavior will follow the new mode for upcoming sessions.</li>
              </ul>
            </div>
            <p>Do you want to continue?</p>
          </div>
        )}
        confirmLabel="Confirm Change"
        cancelLabel="Cancel"
        onCancel={handleConfirmCancel}
        onConfirm={() => {
          setShowConfirmDialog(false);
          submitConfiguration();
        }}
        isLoading={isSubmitting}
      />
    </div>
  );
};

export default ClassConfigure;
