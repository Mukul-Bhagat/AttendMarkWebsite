import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, IUser as IAuthUser } from '../contexts/AuthContext';
import AddUsersModal from '../components/AddUsersModal';
import GoogleMapPicker from '../components/GoogleMapPicker';
import { X } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { nowIST, formatIST, toISTDateString, istDayStart } from '../utils/time';

import { appLogger } from '../shared/logger';
interface IUser {
  _id: string;
  email: string;
  role: string;
  profile: {
    firstName: string;
    lastName: string;
  };
}

const CreateSession: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSuperAdmin } = useAuth();

  // Check if we're creating a class (from /classes/create) or adding to existing class
  const isCreatingClass = location.pathname.includes('/classes/create');
  const urlParams = new URLSearchParams(location.search);
  const existingClassId = urlParams.get('classId');

  // State for existing class details (when adding session to existing class)
  const [existingClassName, setExistingClassName] = useState('');
  const [isLoadingClass, setIsLoadingClass] = useState(!!existingClassId);

  // Determine if we're in "Add Single Session" mode (existingClassId present)
  const isAddingToExistingClass = !!existingClassId;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    // Lock frequency to 'OneTime' when adding to existing class
    frequency: 'OneTime' as 'OneTime' | 'Daily' | 'Weekly' | 'Monthly' | 'Random',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    locationType: 'Physical' as 'Physical' | 'Virtual' | 'Hybrid', // Legacy field
    sessionType: 'PHYSICAL' as 'PHYSICAL' | 'REMOTE' | 'HYBRID', // New field
    virtualLocation: '',
    geolocation: { latitude: 0, longitude: 0 },
    radius: 100,
    weeklyDays: [] as string[],
    sessionAdmin: '', // Only for SuperAdmin
  });

  // Custom dates for Random frequency
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  // Grace Period State (New)
  const [useOrgGracePeriod, setUseOrgGracePeriod] = useState(true);
  const [customGracePeriod, setCustomGracePeriod] = useState(15);

  const [assignedUsers, setAssignedUsers] = useState<IUser[]>([]); // Legacy: for Physical/Remote single mode
  const [physicalUsers, setPhysicalUsers] = useState<IUser[]>([]); // For Hybrid: Physical attendees
  const [remoteUsers, setRemoteUsers] = useState<IUser[]>([]); // For Hybrid: Remote attendees
  const [sessionAdmins, setSessionAdmins] = useState<IUser[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userModalContext, setUserModalContext] = useState<'PHYSICAL' | 'REMOTE' | 'ALL'>('ALL');
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Fetch existing class details when adding to existing class
  useEffect(() => {
    if (existingClassId) {
      const fetchClassDetails = async () => {
        setIsLoadingClass(true);
        try {
          const { data } = await api.get(`/api/classes/${existingClassId}`);
          setExistingClassName(data.name || '');
          // Pre-fill the name field with the class name
          setFormData(prev => ({
            ...prev,
            name: data.name || '',
            description: data.description || '',
          }));
        } catch (err) {
          appLogger.error('Could not fetch class details:', err);
          setError('Failed to load class details. Please try again.');
        } finally {
          setIsLoadingClass(false);
        }
      };
      fetchClassDetails();
    }
  }, [existingClassId]);

  // Auto-focus first input on mount (only if not loading class)
  useEffect(() => {
    if (!isLoadingClass) {
      nameInputRef.current?.focus();
    }
  }, [isLoadingClass]);

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

    // When sessionType changes, clear user lists if switching to/from Hybrid
    if (name === 'sessionType') {
      if (value === 'HYBRID') {
        // Switching to Hybrid: clear legacy assignedUsers
        setAssignedUsers([]);
      } else {
        // Switching from Hybrid: clear physical/remote users
        setPhysicalUsers([]);
        setRemoteUsers([]);
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
      // Legacy: for Physical or Remote single mode
      setAssignedUsers(users);
    }
    setShowUserModal(false);
  };

  const openUserModal = (context: 'PHYSICAL' | 'REMOTE' | 'ALL') => {
    setUserModalContext(context);
    setShowUserModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate weekly days
    if (formData.frequency === 'Weekly' && formData.weeklyDays.length === 0) {
      setError('Please select at least one day for weekly classes/batches');
      return;
    }

    // Validate custom dates for Random frequency
    if (formData.frequency === 'Random' && selectedDates.length === 0) {
      setError('Please select at least one date for custom date sessions');
      return;
    }

    // Validate end date is after start date
    if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
      setError('End date must be after start date');
      return;
    }

    // Validate end time is after start time
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      setError('End time must be after start time');
      return;
    }

    // Validate location for PHYSICAL or HYBRID sessions
    if (formData.sessionType === 'PHYSICAL' || formData.sessionType === 'HYBRID') {
      if (!selectedCoordinates || !selectedCoordinates.latitude || !selectedCoordinates.longitude) {
        setError('Please select a location on the map for Physical or Hybrid classes/batches.');
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Combine users based on sessionType
      let combinedAssignedUsers: Array<{
        userId: string;
        email: string;
        firstName: string;
        lastName: string;
        mode: 'PHYSICAL' | 'REMOTE';
      }> = [];

      if (formData.sessionType === 'HYBRID') {
        // For Hybrid: combine physicalUsers and remoteUsers with their modes
        combinedAssignedUsers = [
          ...physicalUsers.map(u => ({
            userId: u._id,
            email: u.email,
            firstName: u.profile.firstName,
            lastName: u.profile.lastName,
            mode: 'PHYSICAL' as const,
          })),
          ...remoteUsers.map(u => ({
            userId: u._id,
            email: u.email,
            firstName: u.profile.firstName,
            lastName: u.profile.lastName,
            mode: 'REMOTE' as const,
          })),
        ];
      } else {
        // For Physical or Remote: use assignedUsers with appropriate mode
        const mode = formData.sessionType === 'PHYSICAL' ? 'PHYSICAL' : 'REMOTE';
        combinedAssignedUsers = assignedUsers.map(u => ({
          userId: u._id,
          email: u.email,
          firstName: u.profile.firstName,
          lastName: u.profile.lastName,
          mode: mode as 'PHYSICAL' | 'REMOTE',
        }));
      }

      // Build location object for PHYSICAL or HYBRID sessions
      // Backend expects: { type: 'COORDS', geolocation: { latitude, longitude } }
      let locationObj = undefined;
      if (formData.sessionType === 'PHYSICAL' || formData.sessionType === 'HYBRID') {
        if (!selectedCoordinates) {
          setError('Please select a location on the map.');
          setIsSubmitting(false);
          return;
        }

        locationObj = {
          type: 'COORDS',
          geolocation: {
            latitude: selectedCoordinates.latitude,
            longitude: selectedCoordinates.longitude,
          },
        };
      }

      // If creating a new class, use ClassBatch API
      if (isCreatingClass) {
        const classBatchData = {
          name: formData.name,
          description: formData.description || undefined,
          defaultTime: formData.startTime || undefined,
          generateSessions: true,
          frequency: formData.frequency,
          startDate: formData.frequency === 'Random' ? undefined : formData.startDate,
          endDate: formData.frequency === 'Random' ? undefined : (formData.endDate || undefined),
          startTime: formData.startTime,
          endTime: formData.endTime,
          locationType: formData.locationType,
          sessionType: formData.sessionType,
          virtualLocation: formData.sessionType === 'REMOTE' || formData.sessionType === 'HYBRID' ? formData.virtualLocation : undefined,
          location: locationObj,
          radius: (formData.sessionType === 'PHYSICAL' || formData.sessionType === 'HYBRID') && formData.radius
            ? formData.radius
            : undefined,
          assignedUsers: combinedAssignedUsers,
          weeklyDays: formData.frequency === 'Weekly' ? formData.weeklyDays : undefined,
          customDates: formData.frequency === 'Random' ? selectedDates.map(d => toISTDateString(istDayStart(d.toISOString()))) : undefined,
          sessionAdmin: isSuperAdmin && formData.sessionAdmin && formData.sessionAdmin !== '' && formData.sessionAdmin !== 'none'
            ? formData.sessionAdmin  // Send only ID
            : null,  // Send null when no admin selected
          useOrganizationGracePeriod: useOrgGracePeriod,
          gracePeriod: !useOrgGracePeriod ? customGracePeriod : undefined,
        };

        const { data } = await api.post('/api/classes', classBatchData);

        // Navigate based on number of sessions created
        if (data.sessionsCreated === 1 && data.sessions && data.sessions.length > 0) {
          navigate(`/sessions/${data.sessions[0]._id}`);
        } else if (data.classBatch) {
          navigate(`/classes/${data.classBatch._id}/sessions`);
        } else {
          navigate('/classes');
        }
      } else {
        // Existing session creation flow (backward compatibility)
        // Force 'OneTime' frequency when adding to existing class
        const effectiveFrequency = isAddingToExistingClass ? 'OneTime' : formData.frequency;

        const sessionData = {
          ...formData,
          frequency: effectiveFrequency, // Enforce OneTime for existing class
          assignedUsers: combinedAssignedUsers,
          endDate: effectiveFrequency === 'OneTime' ? undefined : (formData.endDate || undefined),
          weeklyDays: effectiveFrequency === 'Weekly' ? formData.weeklyDays : undefined,
          virtualLocation: formData.sessionType === 'REMOTE' || formData.sessionType === 'HYBRID'
            ? formData.virtualLocation
            : undefined,
          location: locationObj,
          radius: (formData.sessionType === 'PHYSICAL' || formData.sessionType === 'HYBRID') && formData.radius
            ? formData.radius
            : undefined,
          sessionAdmin: isSuperAdmin && formData.sessionAdmin && formData.sessionAdmin !== '' && formData.sessionAdmin !== 'none'
            ? formData.sessionAdmin  // Send only ID
            : null,  // Send null when no admin selected
          classBatchId: existingClassId || undefined, // Link to existing class if provided
        };

        await api.post('/api/sessions', sessionData);

        if (existingClassId) {
          navigate(`/classes/${existingClassId}/sessions`);
        } else {
          navigate('/classes');
        }
      }
    } catch (err: any) {
      if (err.response && err.response.data) {
        if (err.response.data.errors && Array.isArray(err.response.data.errors)) {
          const errorMessages = err.response.data.errors.map((e: any) => e.msg).join(', ');
          setError(errorMessages);
        } else {
          setError(err.response.data.msg || 'Failed to create session');
        }
      } else {
        setError('Failed to create session. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
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

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="relative flex min-h-screen w-full flex-col p-4 sm:p-6 lg:p-8 bg-background-light dark:bg-background-dark font-display">
      <div className="mx-auto flex w-full max-w-4xl flex-col">
        <div className="mb-8">
          <p className="text-3xl font-black leading-tight tracking-[-0.033em] text-[#181511] dark:text-white sm:text-4xl">
            {isAddingToExistingClass
              ? `Add Single Session to "${existingClassName || 'Loading...'}"`
              : (isCreatingClass ? 'Create New Class/Batch' : 'Create New Session')
            }
          </p>
          {isAddingToExistingClass && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
              This will add a single one-time session to the existing class.
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 flex items-center rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            <span className="material-symbols-outlined mr-2 text-xl">error</span>
            <p>{error}</p>
          </div>
        )}

        {/* Loading state when fetching existing class details */}
        {isLoadingClass && (
          <div className="mb-6 flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900/50 dark:bg-blue-900/20">
            <svg className="animate-spin h-6 w-6 text-[#f04129] mr-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-blue-700 dark:text-blue-300">Loading class details...</span>
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
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">
                  Class/Batch Name
                  {isAddingToExistingClass && (
                    <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(Read-only)</span>
                  )}
                </p>
                <input
                  ref={nameInputRef}
                  className={`form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] placeholder:text-[#8a7b60] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-400 dark:focus:border-primary/80 ${isAddingToExistingClass ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed opacity-75' : ''
                    }`}
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  autoComplete="off"
                  placeholder="Enter the class/batch name"
                  disabled={isAddingToExistingClass}
                  readOnly={isAddingToExistingClass}
                />
                {isAddingToExistingClass && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    The session will be added to this existing class.
                  </p>
                )}
              </label>
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Description</p>
                <textarea
                  className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] placeholder:text-[#8a7b60] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-400 dark:focus:border-primary/80"
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter a description for the session"
                />
              </label>
              {/* Date/Time inputs - different layout for Random frequency */}
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
                  {formData.frequency !== 'OneTime' && (
                    <label className="flex flex-col">
                      <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">End Date</p>
                      <input
                        className="form-input w-full rounded-lg border border-[#e6e2db] bg-white p-3 text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        name="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={handleChange}
                        min={formData.startDate}
                      />
                    </label>
                  )}
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
                        disabled={{ before: new Date(nowIST()) }}
                        numberOfMonths={2}
                        showOutsideDays
                        className="mx-auto"
                      />
                    </div>
                    {selectedDates.length === 0 && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-2">Please select at least one date</p>
                    )}
                    {selectedDates.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedDates.sort((a, b) => a.getTime() - b.getTime()).map((date, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[#f04129]/10 text-[#f04129] text-xs rounded-full"
                          >
                            {formatIST(date.getTime(), { month: 'short', day: 'numeric', year: 'numeric' })}
                            <button
                              type="button"
                              onClick={() => setSelectedDates(selectedDates.filter((_, i) => i !== index))}
                              className="hover:bg-[#f04129]/20 rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <label className="flex flex-col">
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">
                  Frequency
                  {isAddingToExistingClass && (
                    <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(Locked to One-Time)</span>
                  )}
                </p>
                <div className="relative">
                  <select
                    className={`form-select w-full appearance-none rounded-lg border border-[#e6e2db] bg-white p-3 text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 ${isAddingToExistingClass ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed opacity-75' : ''
                      }`}
                    name="frequency"
                    value={isAddingToExistingClass ? 'OneTime' : formData.frequency}
                    onChange={(e) => {
                      if (isAddingToExistingClass) return; // Prevent changes when adding to existing class
                      handleChange(e);
                      // Clear selected dates when switching away from Random
                      if (e.target.value !== 'Random') {
                        setSelectedDates([]);
                      }
                    }}
                    required
                    disabled={isAddingToExistingClass}
                  >
                    <option value="OneTime">One-Time</option>
                    {!isAddingToExistingClass && (
                      <>
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Random">Custom Dates (Select Manually)</option>
                      </>
                    )}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">unfold_more</span>
                </div>
                {isAddingToExistingClass && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    When adding to an existing class, only single sessions can be added.
                  </p>
                )}
              </label>
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
                  {formData.weeklyDays.length === 0 && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-2">Please select at least one day for weekly classes/batches</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* New Section: Grace Period Settings (Only for new classes) */}
          {isCreatingClass && (
            <div className="flex flex-col gap-5 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-[#f04129]">timer</span>
                <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Attendance Grace Period</h2>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer p-3 border border-[#e6e2db] dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={useOrgGracePeriod}
                      onChange={(e) => setUseOrgGracePeriod(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#f04129]"></div>
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[#181511] dark:text-white">Use Organization Default</span>
                    <p className="text-xs text-[#8a7b60] dark:text-gray-400">
                      Use the global grace period setting defined in Organization Settings.
                    </p>
                  </div>
                </label>

                {!useOrgGracePeriod && (
                  <div className="pl-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-sm font-medium text-[#5c5445] dark:text-slate-300 mb-2">
                      Custom Grace Period (Minutes)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="180"
                        value={customGracePeriod}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 0) setCustomGracePeriod(val);
                        }}
                        className="form-input w-32 rounded-lg border border-[#e6e2db] bg-white p-2 text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <span className="text-sm text-[#8a7b60] dark:text-gray-400">minutes after session start time</span>
                    </div>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">warning</span>
                      This will override the organization default for this specific class.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

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

            {/* Informational Messages based on Session Type */}
            {formData.sessionType === 'PHYSICAL' && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 mt-0.5">info</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                      Physical Session Information
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      The QR code will be scanned only in the area you specify through the Google Maps link. Users must be at the location to mark their attendance.
                    </p>
                    <a
                      href="https://maps.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">map</span>
                      Open Google Maps
                    </a>
                  </div>
                </div>
              </div>
            )}

            {formData.sessionType === 'REMOTE' && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-green-600 dark:text-green-400 mt-0.5">info</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
                      Remote Session Information
                    </p>
                    <p className="text-sm text-green-800 dark:text-green-300">
                      This session doesn't require a location. Users can scan the QR code from any location and mark their attendance remotely.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {formData.sessionType === 'HYBRID' && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-red-600 dark:text-red-400 mt-0.5">info</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-200 mb-1">
                      Hybrid Session Information
                    </p>
                    <p className="text-sm text-red-800 dark:text-red-300 mb-2">
                      Selected people assigned as "Physical" must come to the specified location to mark attendance. Users assigned as "Remote" can mark attendance from any location.
                    </p>
                    <a
                      href="https://maps.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">map</span>
                      Open Google Maps
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Location (Conditional) */}
          {(formData.sessionType === 'PHYSICAL' || formData.sessionType === 'HYBRID') && (
            <div className="flex flex-col gap-6 rounded-xl border border-[#e6e2db] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-[#f04129]">pin_drop</span>
                <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Location Details</h2>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">
                    Session Location <span className="text-red-500">*</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#e6e2db] dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-[#181511] dark:text-slate-200 hover:border-[#f04129] hover:bg-red-50 dark:hover:bg-[#f04129]/10 transition-colors duration-200"
                  >
                    <span className="material-symbols-outlined text-2xl text-[#f04129]">map</span>
                    <span className="font-semibold">
                      {selectedCoordinates ? 'Change Location on Map' : 'Select Location on Map'}
                    </span>
                  </button>
                  {selectedCoordinates && (
                    <div className="mt-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-green-600 dark:text-green-400 mt-0.5">check_circle</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
                            Location Selected
                          </p>
                          <p className="text-sm text-green-800 dark:text-green-300 font-mono">
                            Latitude: {selectedCoordinates.latitude.toFixed(6)}, Longitude: {selectedCoordinates.longitude.toFixed(6)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {!selectedCoordinates && (
                    <p className="mt-2 text-xs text-[#8a7b60] dark:text-slate-400">
                      Click the button above to open an interactive map and select the session location. You can click on the map or search for a location.
                    </p>
                  )}
                </div>
                <label className="flex flex-col">
                  <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Radius (meters)</p>
                  <input
                    className="form-input flex w-full resize-none overflow-hidden rounded-lg border border-[#e6e2db] bg-white p-3 text-base font-normal leading-normal text-[#181511] placeholder:text-[#8a7b60] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-400 dark:focus:border-primary/80"
                    type="number"
                    name="radius"
                    value={formData.radius}
                    onChange={handleChange}
                    placeholder="e.g., 100"
                    min="1"
                    required
                  />
                  <p className="mt-1 text-xs text-[#8a7b60] dark:text-slate-400">
                    Maximum distance (in meters) from the selected location where attendance can be marked. Default: 100 meters.
                  </p>
                </label>
              </div>
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
                <p className="pb-2 text-sm font-medium leading-normal text-[#5c5445] dark:text-slate-300">Session Admin (Optional)</p>
                <div className="relative">
                  <select
                    className="form-select w-full appearance-none rounded-lg border border-[#e6e2db] bg-white p-3 text-[#181511] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    name="sessionAdmin"
                    value={formData.sessionAdmin}
                    onChange={handleChange}
                  >
                    <option value="">No Admin (Default)</option>
                    {sessionAdmins.map((admin) => (
                      <option key={admin._id} value={admin._id}>
                        {admin.profile.firstName} {admin.profile.lastName} ({admin.email})
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">unfold_more</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Leave as "No Admin" to not assign a specific session administrator.
                </p>
              </label>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={() => {
                if (isAddingToExistingClass && existingClassId) {
                  navigate(`/classes/${existingClassId}/sessions`);
                } else if (isCreatingClass) {
                  navigate('/classes');
                } else {
                  navigate('/classes');
                }
              }}
              className="rounded-lg px-6 py-3 font-semibold text-[#5c5445] transition-colors duration-200 hover:bg-[#f5f3f0] dark:text-slate-300 dark:hover:bg-slate-700"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingClass}
              className="flex items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 to-[#f04129] px-8 py-3 font-semibold text-white transition-all duration-200 hover:from-orange-600 hover:to-[#d63a25] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined mr-2 text-xl">add_circle</span>
              {isSubmitting
                ? (isAddingToExistingClass ? 'Adding Session...' : 'Creating Session...')
                : (isAddingToExistingClass ? 'Add Session' : 'Create Session')
              }
            </button>
          </div>
        </form>

        {showUserModal && (
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
        )}

        {/* Google Maps Picker Modal */}
        <GoogleMapPicker
          isOpen={showMapPicker}
          onClose={() => setShowMapPicker(false)}
          onConfirm={(data) => {
            setSelectedCoordinates({ latitude: data.latitude, longitude: data.longitude });
            setFormData(prev => ({ ...prev, radius: data.radius }));
            setShowMapPicker(false);
          }}
          initialCoordinates={selectedCoordinates}
          initialRadius={formData.radius}
          apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}
        />
      </div>
    </div>
  );
};

export default CreateSession;

