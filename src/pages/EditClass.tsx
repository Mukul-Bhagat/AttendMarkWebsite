import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth, IUser as IAuthUser } from '../contexts/AuthContext';
import AddUsersModal from '../components/AddUsersModal';
import GoogleMapPicker from '../components/GoogleMapPicker';
import { X, ArrowLeft } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

import { appLogger } from '../shared/logger';
import SkeletonCard from '../components/SkeletonCard';
interface IUser {
  _id: string;
  email: string;
  role: string;
  profile: {
    firstName: string;
    lastName: string;
  };
}

const EditClass: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isSuperAdmin } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    frequency: 'OneTime' as 'OneTime' | 'Daily' | 'Weekly' | 'Monthly' | 'Random',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    locationType: 'Physical' as 'Physical' | 'Virtual' | 'Hybrid',
    sessionType: 'PHYSICAL' as 'PHYSICAL' | 'REMOTE' | 'HYBRID',
    virtualLocation: '',
    geolocation: { latitude: 0, longitude: 0 },
    radius: 100,
    weeklyDays: [] as string[],
    sessionAdmin: '',
  });

  // Custom dates for Random frequency
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  const [assignedUsers, setAssignedUsers] = useState<IUser[]>([]);
  const [physicalUsers, setPhysicalUsers] = useState<IUser[]>([]);
  const [remoteUsers, setRemoteUsers] = useState<IUser[]>([]);
  const [sessionAdmins, setSessionAdmins] = useState<IAuthUser[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userModalContext, setUserModalContext] = useState<'PHYSICAL' | 'REMOTE' | 'ALL'>('ALL');
  const initialUserIdsRef = useRef<Set<string>>(new Set());

  // Location State
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sendNotification, setSendNotification] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Fetch ClassBatch and first session
  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError('Invalid class ID');
        setIsLoading(false);
        return;
      }

      try {
        // Fetch ClassBatch
        const classRes = await api.get(`/api/classes/${id}`);
        const classData = classRes.data;

        // Fetch sessions for this class
        const sessionsRes = await api.get(`/api/classes/${id}/sessions`);
        const sessions = sessionsRes.data.sessions || [];

        if (sessions.length > 0) {
          const session = sessions[0];

          // Pre-fill form from ClassBatch + first session
          // ClassBatch is the authoritative source for startDate/endDate
          // Session provides schedule details (frequency, times, location)
          const startDateRaw = classData.startDate || session.startDate;
          const endDateRaw = classData.endDate || session.endDate;

          const startDate = startDateRaw ? new Date(startDateRaw) : null;
          const endDate = endDateRaw ? new Date(endDateRaw) : null;

          setFormData({
            name: classData.name || '',
            description: classData.description || '',
            frequency: classData.frequency || session.frequency || 'OneTime',
            startDate: startDate ? startDate.toISOString().split('T')[0] : '',
            endDate: endDate ? endDate.toISOString().split('T')[0] : '',
            startTime: session.startTime || '',
            endTime: session.endTime || '',
            locationType: session.locationType || 'Physical',
            sessionType: session.sessionType || 'PHYSICAL',
            virtualLocation: session.virtualLocation || '',
            geolocation: session.geolocation || session.location?.geolocation || { latitude: 0, longitude: 0 },
            radius: session.radius || 100,
            weeklyDays: session.weeklyDays || [],
            sessionAdmin: classData.sessionAdmin || session.sessionAdmin || '',
          });

          // Pre-fill Coordinates
          if (session.location && session.location.geolocation) {
            setSelectedCoordinates(session.location.geolocation);
          } else if (session.geolocation) {
            // Legacy fallback
            setSelectedCoordinates(session.geolocation);
          } else if (classData.defaultLocation && typeof classData.defaultLocation === 'string' && classData.defaultLocation.includes(',')) {
            // Try to parse legacy string coords if needed
          }

          // Pre-fill assigned users
          if (session.assignedUsers && session.assignedUsers.length > 0) {
            try {
              const { data: allUsers } = await api.get('/api/users/my-organization');

              if (session.sessionType === 'HYBRID') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const physicalIds = session.assignedUsers.filter((u: any) => u.mode === 'PHYSICAL').map((u: any) => u.userId);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const remoteIds = session.assignedUsers.filter((u: any) => u.mode === 'REMOTE').map((u: any) => u.userId);

                setPhysicalUsers(allUsers.filter((u: IUser) => physicalIds.includes(u._id)));
                setRemoteUsers(allUsers.filter((u: IUser) => remoteIds.includes(u._id)));
                initialUserIdsRef.current = new Set([...physicalIds, ...remoteIds]);
              } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const userIds = session.assignedUsers.map((u: any) => u.userId);
                setAssignedUsers(allUsers.filter((u: IUser) => userIds.includes(u._id)));
                initialUserIdsRef.current = new Set(userIds);
              }
            } catch (err) {
              appLogger.error('Error fetching users:', err);
            }
          }
        } else {
          // No sessions, just pre-fill from ClassBatch
          const classStart = classData.startDate ? new Date(classData.startDate).toISOString().split('T')[0] : '';
          const classEnd = classData.endDate ? new Date(classData.endDate).toISOString().split('T')[0] : '';
          setFormData({
            name: classData.name || '',
            description: classData.description || '',
            frequency: 'OneTime',
            startDate: classStart,
            endDate: classEnd,
            startTime: classData.defaultTime || '',
            endTime: '',
            locationType: 'Physical',
            sessionType: 'PHYSICAL',
            virtualLocation: '',
            geolocation: { latitude: 0, longitude: 0 },
            radius: 100,
            weeklyDays: [],
            sessionAdmin: classData.sessionAdmin || '',
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Class not found');
        } else {
          setError('Failed to load class. Please try again.');
        }
        appLogger.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (!isLoading) {
      nameInputRef.current?.focus();
    }
  }, [isLoading]);

  // Fetch SessionAdmins if user is SuperAdmin
  useEffect(() => {
    if (isSuperAdmin) {
      const fetchSessionAdmins = async () => {
        try {
          const { data } = await api.get('/api/users/my-organization');
          const admins = data.filter((u: IAuthUser) => u.role === 'SessionAdmin');
          setSessionAdmins(admins);
        } catch (err) {
          appLogger.error('Could not fetch SessionAdmins', err);
        }
      };
      fetchSessionAdmins();
    }
  }, [isSuperAdmin]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');

    if (name === 'sessionType') {
      if (value === 'HYBRID') {
        setAssignedUsers([]);
      } else {
        setPhysicalUsers([]);
        setRemoteUsers([]);
      }

      // Auto-set locationType based on sessionType for backward compatibility
      if (value === 'REMOTE') {
        setFormData(prev => ({ ...prev, locationType: 'Virtual' }));
      } else if (value === 'HYBRID') {
        setFormData(prev => ({ ...prev, locationType: 'Hybrid' }));
      } else {
        setFormData(prev => ({ ...prev, locationType: 'Physical' }));
      }
    }
  };

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      weeklyDays: prev.weeklyDays.includes(day)
        ? prev.weeklyDays.filter(d => d !== day)
        : [...prev.weeklyDays, day],
    }));
  };

  const handleSaveUsers = (users: IUser[]) => {
    if (userModalContext === 'PHYSICAL') {
      setPhysicalUsers(users);
    } else if (userModalContext === 'REMOTE') {
      setRemoteUsers(users);
    } else {
      setAssignedUsers(users);
    }
    setShowUserModal(false);
  };

  const openUserModal = (context: 'PHYSICAL' | 'REMOTE' | 'ALL') => {
    setUserModalContext(context);
    setShowUserModal(true);
  };

  const handleRemoveUser = (userId: string, listType: 'PHYSICAL' | 'REMOTE' | 'ALL') => {
    if (listType === 'PHYSICAL') {
      setPhysicalUsers(physicalUsers.filter(u => u._id !== userId));
    } else if (listType === 'REMOTE') {
      setRemoteUsers(remoteUsers.filter(u => u._id !== userId));
    } else {
      setAssignedUsers(assignedUsers.filter(u => u._id !== userId));
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic validations
    if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
      setError('End date must be after start date');
      return;
    }

    setIsSubmitting(true);

    try {
      // Normalize sessionAdmin: empty string should be undefined
      let normalizedSessionAdmin: string | undefined = undefined;
      if (isSuperAdmin && formData.sessionAdmin) {
        // If it's an object (though state is string initialized), stringify it, else use as is
        if (typeof formData.sessionAdmin === 'object') {
          // @ts-expect-error Disable TS check
          normalizedSessionAdmin = formData.sessionAdmin._id || undefined;
        } else if (typeof formData.sessionAdmin === 'string' && formData.sessionAdmin.trim() !== '') {
          normalizedSessionAdmin = formData.sessionAdmin;
        }
      }

      // Construct FULL payload for backend
      // We send all fields because we want to propagate these settings to future sessions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        defaultTime: formData.startTime || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        sendNotification,


        // Session Configuration Propagation Fields
        endTime: formData.endTime, // Pass endTime explicitly for session updates
        frequency: formData.frequency, // Required for extending sessions
        weeklyDays: formData.weeklyDays, // Required for extending sessions

        sessionAdmin: normalizedSessionAdmin,

        locationType: formData.locationType,
        sessionType: formData.sessionType,
        physicalLocation: formData.locationType === 'Physical' ? formData.name : undefined, // Legacy/Fallback
        virtualLocation: formData.virtualLocation || undefined,
        radius: formData.radius,

        // Location Object Structure
        location: formData.locationType !== 'Virtual' ? {
          type: 'COORDS',
          geolocation: formData.geolocation?.latitude ? {
            latitude: Number(formData.geolocation.latitude),
            longitude: Number(formData.geolocation.longitude)
          } : undefined
        } : undefined,

        // Flat geolocation for legacy support
        geolocation: formData.geolocation?.latitude ? {
          latitude: Number(formData.geolocation.latitude),
          longitude: Number(formData.geolocation.longitude)
        } : undefined
      };

      appLogger.info('[EDIT_CLASS] Sending update payload:', JSON.stringify(updateData, null, 2));

      const response = await api.put(`/api/classes/${id}`, updateData);

      appLogger.info('[EDIT_CLASS] Update successful:', response.data);

      // Sync class enrollments (add/remove users)
      const currentUserIds = new Set<string>(
        formData.sessionType === 'HYBRID'
          ? [...physicalUsers.map(u => u._id), ...remoteUsers.map(u => u._id)]
          : assignedUsers.map(u => u._id)
      );

      const initialUserIds = initialUserIdsRef.current;
      const usersToAdd = Array.from(currentUserIds).filter(id => !initialUserIds.has(id));
      const usersToRemove = Array.from(initialUserIds).filter(id => !currentUserIds.has(id));

      if (usersToAdd.length > 0 || usersToRemove.length > 0) {
        // eslint-disable-next-line no-restricted-syntax
        const joinedAt = new Date().toISOString();
        const addCalls = usersToAdd.map(userId =>
          api.post(`/api/membership/${userId}/assign-class`, {
            classBatchId: id,
            joinedAt
          })
        );
        const removeCalls = usersToRemove.map(userId =>
          api.post(`/api/membership/${userId}/remove-class`, {
            classBatchId: id
          })
        );

        await Promise.all([...addCalls, ...removeCalls]);
        // Update baseline after successful sync
        initialUserIdsRef.current = currentUserIds;
      }

      // Store success message in history state if possible or just navigate
      navigate('/classes', { state: { message: 'Class and sessions updated successfully.' } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      appLogger.error('[EDIT_CLASS] Update failed:', err);

      if (err.response && err.response.data) {
        appLogger.error('[EDIT_CLASS] Backend Error Response:', err.response.data);

        // Handle new error format from backend
        if (err.response.data.message) {
          setError(err.response.data.message);
        } else if (err.response.data.errors && Array.isArray(err.response.data.errors)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const errorMessages = err.response.data.errors.map((e: any) => e.msg || e.message).join(', ');
          setError(errorMessages);
        } else {
          setError('Failed to update class');
        }
      } else {
        setError('Failed to update class. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  if (isLoading) {
    return (
      <div className="relative flex min-h-screen w-full flex-col p-4 sm:p-6 lg:p-8 bg-background-light dark:bg-background-dark font-display">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <div className="mb-8">
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse mb-4" />
            <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          </div>
          <SkeletonCard variant="card" className="h-48" />
          <SkeletonCard variant="card" className="h-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonCard variant="card" className="h-48" />
            <SkeletonCard variant="card" className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col p-4 sm:p-6 lg:p-8 bg-background-light dark:bg-background-dark font-display">
      <div className="mx-auto flex w-full max-w-4xl flex-col">
        <div className="mb-8">
          <Link
            to="/classes"
            className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#f5f3f0] dark:bg-slate-800 text-[#181511] dark:text-gray-200 gap-2 text-sm font-bold leading-normal tracking-[0.015em] border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="truncate">Back to Classes</span>
          </Link>
          <p className="text-3xl font-black leading-tight tracking-[-0.033em] text-[#181511] dark:text-white sm:text-4xl">Edit Class</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Update class details, location, and assigned users. Existing session dates will be preserved.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            <span className="material-symbols-outlined mr-2 text-xl">error</span>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col space-y-6">
          {/* Section 1: Basic Details */}
          <div className="flex flex-col gap-6 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-[#f04129]">calendar_month</span>
              <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Basic Details</h2>
            </div>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Class/Batch Name</p>
                <input
                  ref={nameInputRef}
                  className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] placeholder:text-[#8a7b60] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-400 dark:focus:border-primary/80"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  autoComplete="off"
                  placeholder="Enter the class/batch name"
                />
              </label>
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Description</p>
                <textarea
                  className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] placeholder:text-[#8a7b60] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-400 dark:focus:border-primary/80"
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter a description for the class"
                />
              </label>

              {/* Frequency Selector */}
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Frequency</p>
                <div className="relative">
                  <select
                    className="form-select w-full appearance-none rounded-lg border border-[#e6e2db] bg-white p-3 text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    name="frequency"
                    value={formData.frequency}
                    onChange={(e) => {
                      handleChange(e);
                      if (e.target.value !== 'Random') {
                        setSelectedDates([]);
                      }
                    }}
                    required
                  >
                    <option value="OneTime">One-Time</option>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Random">Custom Dates</option>
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">unfold_more</span>
                </div>
              </label>

              {/* Date/Time Inputs */}
              {formData.frequency !== 'Random' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="flex flex-col">
                    <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Start Date</p>
                    <input
                      className="form-input w-full rounded-lg border border-[#e6e2db] bg-white p-3 text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      name="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={handleChange}
                      required
                    />
                  </label>
                  <label className="flex flex-col">
                    <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">
                      End Date {formData.frequency === 'OneTime' && <span className="text-xs text-gray-400">(optional)</span>}
                    </p>
                    <input
                      className="form-input w-full rounded-lg border border-[#e6e2db] bg-white p-3 text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      name="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={handleChange}
                      min={formData.startDate}
                      required={formData.frequency !== 'OneTime'}
                    />
                  </label>
                  <label className="flex flex-col">
                    <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Start Time</p>
                    <input
                      className="form-input w-full rounded-lg border border-[#e6e2db] bg-white p-3 text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      name="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={handleChange}
                      required
                    />
                  </label>
                  <label className="flex flex-col">
                    <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">End Time</p>
                    <input
                      className="form-input w-full rounded-lg border border-[#e6e2db] bg-white p-3 text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      name="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={handleChange}
                      required
                    />
                  </label>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Time inputs for Random frequency */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="flex flex-col">
                      <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Start Time</p>
                      <input
                        className="form-input w-full rounded-lg border border-[#e6e2db] bg-white p-3 text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        name="startTime"
                        type="time"
                        value={formData.startTime}
                        onChange={handleChange}
                        required
                      />
                    </label>
                    <label className="flex flex-col">
                      <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">End Time</p>
                      <input
                        className="form-input w-full rounded-lg border border-[#e6e2db] bg-white p-3 text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        name="endTime"
                        type="time"
                        value={formData.endTime}
                        onChange={handleChange}
                        required
                      />
                    </label>
                  </div>

                  {/* Custom Date Picker */}
                  <div>
                    <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">
                      Select Dates ({selectedDates.length} selected)
                    </p>
                    <div className="rounded-lg border border-[#e6e2db] bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                      <style>{`
                        .rdp {
                          --rdp-cell-size: 40px;
                          --rdp-accent-color: #f04129;
                          --rdp-background-color: #f04129;
                          margin: 0;
                        }
                        .dark .rdp {
                          --rdp-accent-color: #f04129;
                          --rdp-background-color: #f04129;
                        }
                        .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                          background-color: rgba(240, 65, 41, 0.1);
                        }
                        .dark .rdp-caption {
                          color: #e2e8f0;
                        }
                        .dark .rdp-head_cell {
                          color: #94a3b8;
                        }
                        .dark .rdp-day {
                          color: #e2e8f0;
                        }
                        .dark .rdp-day_outside {
                          color: #475569;
                        }
                        .rdp-day_selected {
                          background-color: #f04129 !important;
                          color: white !important;
                        }
                        .rdp-day_selected:hover {
                          background-color: #d63a25 !important;
                        }
                        .dark .rdp-nav_button {
                          color: #e2e8f0;
                        }
                        .dark .rdp-nav_button:hover {
                          background-color: rgba(240, 65, 41, 0.2);
                        }
                      `}</style>
                      <DayPicker
                        mode="multiple"
                        selected={selectedDates}
                        onSelect={(dates) => setSelectedDates(dates || [])}
                        numberOfMonths={2}
                        showOutsideDays
                        className="mx-auto"
                      />
                    </div>
                  </div>
                </div>
              )}



              {formData.frequency === 'Weekly' && (
                <div>
                  <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Repeat On</p>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map((day, index) => {
                      const isSelected = formData.weeklyDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDayToggle(day)}
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors duration-200 ${isSelected
                            ? 'bg-gradient-to-r from-orange-500 to-[#f04129] text-white'
                            : 'bg-[#f5f3f0] text-[#181511] hover:bg-[#e6e2db] dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
                            }`}
                        >
                          {dayLabels[index]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Session Mode */}
          <div className="flex flex-col gap-5 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-[#f04129]">devices</span>
              <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Session Mode</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  const syntheticEvent = {
                    target: { name: 'sessionType', value: 'PHYSICAL' }
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleChange(syntheticEvent);
                }}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-6 text-center shadow-md transition-all duration-200 ${formData.sessionType === 'PHYSICAL'
                  ? 'border-[#f04129] dark:border-[#f04129]'
                  : 'border-[#e6e2db] hover:border-[#d6d0c6] dark:border-slate-700 dark:hover:border-slate-600'
                  }`}
              >
                {formData.sessionType === 'PHYSICAL' && (
                  <span className="material-symbols-outlined absolute right-3 top-3 text-xl text-[#f04129]">check_circle</span>
                )}
                <span className={`material-symbols-outlined mb-3 text-3xl ${formData.sessionType === 'PHYSICAL' ? 'text-[#f04129]' : 'text-[#5c5445] dark:text-slate-400'}`}>location_on</span>
                <p className="font-semibold text-[#181511] dark:text-white">Physical</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  const syntheticEvent = {
                    target: { name: 'sessionType', value: 'REMOTE' }
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleChange(syntheticEvent);
                }}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-6 text-center shadow-md transition-all duration-200 ${formData.sessionType === 'REMOTE'
                  ? 'border-[#f04129] dark:border-[#f04129]'
                  : 'border-[#e6e2db] hover:border-[#d6d0c6] dark:border-slate-700 dark:hover:border-slate-600'
                  }`}
              >
                {formData.sessionType === 'REMOTE' && (
                  <span className="material-symbols-outlined absolute right-3 top-3 text-xl text-[#f04129]">check_circle</span>
                )}
                <span className={`material-symbols-outlined mb-3 text-3xl ${formData.sessionType === 'REMOTE' ? 'text-[#f04129]' : 'text-[#5c5445] dark:text-slate-400'}`}>desktop_windows</span>
                <p className="font-semibold text-[#181511] dark:text-white">Remote</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  const syntheticEvent = {
                    target: { name: 'sessionType', value: 'HYBRID' }
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleChange(syntheticEvent);
                }}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-6 text-center shadow-md transition-all duration-200 ${formData.sessionType === 'HYBRID'
                  ? 'border-[#f04129] dark:border-[#f04129]'
                  : 'border-[#e6e2db] hover:border-[#d6d0c6] dark:border-slate-700 dark:hover:border-slate-600'
                  }`}
              >
                {formData.sessionType === 'HYBRID' && (
                  <span className="material-symbols-outlined absolute right-3 top-3 text-xl text-[#f04129]">check_circle</span>
                )}
                <span className={`material-symbols-outlined mb-3 text-3xl ${formData.sessionType === 'HYBRID' ? 'text-[#f04129]' : 'text-[#5c5445] dark:text-slate-400'}`}>hub</span>
                <p className="font-semibold text-[#181511] dark:text-white">Hybrid</p>
              </button>
            </div>
          </div>

          {/* Section 3: Location (Maps Integrated) */}
          {(formData.sessionType === 'PHYSICAL' || formData.sessionType === 'HYBRID') && (
            <div className="flex flex-col gap-6 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-[#f04129]">pin_drop</span>
                  <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Location Details</h2>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {/* Google Map Picker Overlay */}
                <GoogleMapPicker
                  initialCoordinates={selectedCoordinates || undefined}
                  initialRadius={formData.radius}
                  onConfirm={(data) => {
                    setSelectedCoordinates({
                      latitude: data.latitude,
                      longitude: data.longitude,
                    });
                    setFormData(prev => ({ ...prev, radius: data.radius }));
                  }}
                  isOpen={showMapPicker}
                  onClose={() => setShowMapPicker(false)}
                />

                {/* Main Location Selection Area */}
                <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                  {/* Map Preview / Placeholder */}
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
                        Select a precise location on the map for accurate attendance tracking
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

                    {selectedCoordinates && (
                      <p className="mt-3 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Location coordinates locked
                      </p>
                    )}
                  </div>
                </div>

                <label className="flex flex-col">
                  <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Geofence Radius (meters)</p>
                  <input
                    className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] placeholder:text-[#8a7b60] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-400 dark:focus:border-primary/80"
                    type="number"
                    name="radius"
                    value={formData.radius}
                    onChange={handleChange}
                    placeholder="e.g., 50"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Users must be within this distance to mark attendance.
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Section 4: Virtual Location */}
          {(formData.sessionType === 'REMOTE' || formData.sessionType === 'HYBRID') && (
            <div className="flex flex-col gap-6 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-[#f04129]">videocam</span>
                <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Virtual Meeting Link</h2>
              </div>
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Meeting URL</p>
                <input
                  className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] placeholder:text-[#8a7b60] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-400 dark:focus:border-primary/80"
                  name="virtualLocation"
                  type="url"
                  value={formData.virtualLocation}
                  onChange={handleChange}
                  placeholder="https://meet.google.com/..."
                />
              </label>
            </div>
          )}

          {/* Section 5: Attendees */}
          <div className="flex flex-col gap-5 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-[#f04129]">group</span>
              <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Assign Users</h2>
            </div>
            {formData.sessionType === 'HYBRID' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold dark:text-gray-200">Physical Attendees ({physicalUsers.length})</h3>
                  <div className="min-h-[100px] rounded-lg border border-[#e6e2db] p-4 dark:border-slate-700">
                    {physicalUsers.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        {physicalUsers.map(user => (
                          <div key={user._id} className="flex items-center justify-between text-sm">
                            <span className="dark:text-gray-300">{user.profile.firstName} {user.profile.lastName}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveUser(user._id, 'PHYSICAL')}
                              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#8a7b60] dark:text-slate-400">No physical attendees assigned yet.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openUserModal('PHYSICAL')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#f04129] py-2 font-semibold text-[#f04129] transition-colors duration-200 hover:bg-red-50 dark:hover:bg-[#f04129]/10"
                  >
                    <span className="material-symbols-outlined text-xl">add_circle</span>
                    {physicalUsers.length > 0 ? `Edit Physical Users (${physicalUsers.length})` : 'Add Physical Users'}
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold dark:text-gray-200">Remote Attendees ({remoteUsers.length})</h3>
                  <div className="min-h-[100px] rounded-lg border border-[#e6e2db] p-4 dark:border-slate-700">
                    {remoteUsers.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        {remoteUsers.map(user => (
                          <div key={user._id} className="flex items-center justify-between text-sm">
                            <span className="dark:text-gray-300">{user.profile.firstName} {user.profile.lastName}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveUser(user._id, 'REMOTE')}
                              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#8a7b60] dark:text-slate-400">No remote attendees assigned yet.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openUserModal('REMOTE')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#f04129] py-2 font-semibold text-[#f04129] transition-colors duration-200 hover:bg-red-50 dark:hover:bg-[#f04129]/10"
                  >
                    <span className="material-symbols-outlined text-xl">add_circle</span>
                    {remoteUsers.length > 0 ? `Edit Remote Users (${remoteUsers.length})` : 'Add Remote Users'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="min-h-[100px] rounded-lg border border-[#e6e2db] p-4 dark:border-slate-700">
                  {assignedUsers.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {assignedUsers.map(user => (
                        <div key={user._id} className="flex items-center justify-between text-sm">
                          <span className="dark:text-gray-300">{user.profile.firstName} {user.profile.lastName}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveUser(user._id, 'ALL')}
                            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#8a7b60] dark:text-slate-400">No attendees assigned yet.</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openUserModal('ALL')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#f04129] py-2 font-semibold text-[#f04129] transition-colors duration-200 hover:bg-red-50 dark:hover:bg-[#f04129]/10"
                >
                  <span className="material-symbols-outlined text-xl">add_circle</span>
                  {assignedUsers.length > 0 ? `Edit Users (${assignedUsers.length})` : 'Add Users'}
                </button>
              </div>
            )}
          </div>

          {/* Section 6: Administration */}
          {isSuperAdmin && (
            <div className="flex flex-col gap-5 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-[#f04129]">admin_panel_settings</span>
                <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Administration</h2>
              </div>
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Session Admin</p>
                <div className="relative">
                  <select
                    className="form-select w-full appearance-none rounded-lg border border-[#e6e2db] bg-white p-3 text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    name="sessionAdmin"
                    value={formData.sessionAdmin}
                    onChange={handleChange}
                  >
                    <option value="">Select Admin</option>
                    {sessionAdmins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.profile.firstName} {admin.profile.lastName} ({admin.email})
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">unfold_more</span>
                </div>
              </label>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end space-x-4 pt-4">
            <Link
              to="/classes"
              className="rounded-lg px-6 py-3 font-semibold text-[#5c5445] transition-colors duration-200 hover:bg-[#f5f3f0] dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={() => {
                // Validate first
                if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
                  setError('End date must be after start date');
                  return;
                }
                setShowConfirmModal(true);
              }}
              disabled={isSubmitting}
              className="flex items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-[#f04129] px-8 py-3 font-semibold text-white transition-all duration-200 hover:from-orange-600 hover:to-[#d63a25] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined mr-2 text-xl">save</span>
              Update Class
            </button>
          </div>
        </form>

        {
          showUserModal && (
            <AddUsersModal
              onClose={() => setShowUserModal(false)}
              onSave={handleSaveUsers}
              initialSelectedUsers={
                userModalContext === 'PHYSICAL'
                  ? physicalUsers
                  : userModalContext === 'REMOTE'
                    ? remoteUsers
                    : assignedUsers
              }
              context={
                userModalContext === 'PHYSICAL'
                  ? 'Add Physical Attendees'
                  : userModalContext === 'REMOTE'
                    ? 'Add Remote Attendees'
                    : 'Add Users to Session'
              }
            />
          )
        }

        {/* Confirmation Modal */}
        {
          showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md animate-in fade-in zoom-in duration-200 rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                  <span className="material-symbols-outlined text-2xl">warning</span>
                </div>
                <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">Confirm Class Update</h3>
                <p className="mb-6 text-gray-500 dark:text-slate-400">
                  Are you sure you want to save changes to <span className="font-semibold text-gray-900 dark:text-white">"{formData.name}"</span>?
                  Updates will be applied to the class and propagated to future scheduled sessions.
                </p>

                <div className="mb-6 flex items-start gap-3 rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                  <div className="flex h-5 items-center">
                    <input
                      id="notify-users"
                      type="checkbox"
                      checked={sendNotification}
                      onChange={(e) => setSendNotification(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="notify-users" className="text-sm font-medium text-gray-900 dark:text-white">
                      Notify assigned users
                    </label>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Send a notification to all users about this schedule change.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    className="rounded-lg px-5 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                    disabled={isSubmitting}
                  >
                    No, cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setShowConfirmModal(false);
                      const e = { preventDefault: () => { } } as React.FormEvent;
                      await handleSubmit(e);
                    }}
                    disabled={isSubmitting}
                    className="flex items-center justify-center rounded-lg bg-[#f04129] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#d63a25] transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Updating...' : 'Yes, save changes'}
                  </button>
                </div>
              </div>
            </div>
          )
        }
      </div >
    </div >
  );
};

export default EditClass;
