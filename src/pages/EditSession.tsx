import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth, IUser as IAuthUser } from '../contexts/AuthContext';
import { ISession } from '../types';
import AddUsersModal from '../components/AddUsersModal';
import GoogleMapPicker from '../components/GoogleMapPicker';
import { ArrowLeft, X } from 'lucide-react';

import SkeletonCard from '../components/SkeletonCard';
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

const EditSession: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: paramId } = useParams<{ id: string }>();

  // Backward Compatibility: Handle composite IDs (legacy links)
  const sessionId = (paramId || '').includes('_') ? (paramId || '').split('_')[0] : paramId;

  // 🛡️ AUTO-MIGRATE LEGACY URLS (Edit Page)
  // Converts /sessions/edit/XXX_DATE -> /sessions/edit/XXX?date=DATE
  useEffect(() => {
    if (paramId && paramId.includes('_')) {
      const [cleanId, legacyDate] = paramId.split('_');
      const query = new URLSearchParams(location.search);
      const date = query.get('date') || legacyDate;

      appLogger.warn(
        '[LEGACY ROUTE AUTO-FIXED]',
        paramId,
        '→',
        `/sessions/edit/${cleanId}?date=${date}`
      );

      navigate(`/sessions/edit/${cleanId}?date=${date}`, { replace: true });
    }
  }, [paramId, location.search, navigate]);


  const { isSuperAdmin } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
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

  const [assignedUsers, setAssignedUsers] = useState<IUser[]>([]); // Legacy: for Physical/Remote single mode
  const [physicalUsers, setPhysicalUsers] = useState<IUser[]>([]); // For Hybrid: Physical attendees
  const [remoteUsers, setRemoteUsers] = useState<IUser[]>([]); // For Hybrid: Remote attendees
  const [sessionAdmins, setSessionAdmins] = useState<IAuthUser[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userModalContext, setUserModalContext] = useState<'PHYSICAL' | 'REMOTE' | 'ALL'>('ALL');
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Fetch session data on mount
  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) {
        setError('Session ID is required');
        setIsLoading(false);
        return;
      }

      try {
        const query = new URLSearchParams(location.search);
        const dateParam = query.get('date');
        const url = dateParam ? `/api/sessions/${sessionId}/details?date=${dateParam}` : `/api/sessions/${sessionId}`;

        const response = await api.get(url);
        const data: ISession = response.data.session || response.data;

        // Populate form with existing data
        setFormData({
          name: data.name,
          description: data.description || '',
          frequency: data.frequency,
          startDate: data.startDate.split('T')[0], // Extract date part from ISO string
          endDate: data.endDate ? data.endDate.split('T')[0] : '',
          startTime: data.startTime,
          endTime: data.endTime,
          locationType: data.locationType,
          sessionType: data.sessionType || 'PHYSICAL', // Use sessionType from data, default to PHYSICAL
          virtualLocation: data.virtualLocation || '',
          geolocation: data.geolocation || { latitude: 0, longitude: 0 },
          radius: data.radius || 100,
          weeklyDays: data.weeklyDays || [],
          sessionAdmin: data.sessionAdmin || '',
        });

        // Load location coordinates
        if (data.location?.geolocation?.latitude && data.location?.geolocation?.longitude) {
          setSelectedCoordinates({
            latitude: data.location.geolocation.latitude,
            longitude: data.location.geolocation.longitude,
          });
        } else if (data.geolocation?.latitude && data.geolocation?.longitude) {
          // Legacy: if no location object but geolocation exists
          setSelectedCoordinates({
            latitude: data.geolocation.latitude,
            longitude: data.geolocation.longitude,
          });
        }

        // Split assigned users based on their mode
        if (data.assignedUsers && Array.isArray(data.assignedUsers)) {
          const physical: IUser[] = [];
          const remote: IUser[] = [];
          const all: IUser[] = [];

          data.assignedUsers.forEach((u) => {
            const userObj: IUser = {
              _id: u.userId,
              email: u.email,
              role: '', // Role not included in assignedUsers
              profile: {
                firstName: u.firstName,
                lastName: u.lastName,
              },
            };

            all.push(userObj);

            // Split by mode if mode exists, otherwise treat based on sessionType
            if (u.mode) {
              if (u.mode === 'PHYSICAL') {
                physical.push(userObj);
              } else if (u.mode === 'REMOTE') {
                remote.push(userObj);
              }
            } else {
              // Legacy: no mode field, assign based on sessionType
              if (data.sessionType === 'PHYSICAL' || !data.sessionType) {
                physical.push(userObj);
              } else if (data.sessionType === 'REMOTE') {
                remote.push(userObj);
              }
            }
          });

          // Set users based on sessionType
          if (data.sessionType === 'HYBRID') {
            setPhysicalUsers(physical);
            setRemoteUsers(remote);
            setAssignedUsers([]);
          } else {
            setAssignedUsers(all);
            setPhysicalUsers([]);
            setRemoteUsers([]);
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Session not found');
        } else if (err.response?.status === 403) {
          setError('You are not authorized to edit this session');
        } else {
          setError('Failed to fetch session data');
        }
        appLogger.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, location.search]);

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

  // Auto-focus first input after loading
  useEffect(() => {
    if (!isLoading) {
      nameInputRef.current?.focus();
    }
  }, [isLoading]);

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

      const sessionData = {
        name: formData.name,
        description: formData.description || undefined,
        frequency: formData.frequency,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        startTime: formData.startTime,
        endTime: formData.endTime,
        locationType: formData.locationType,
        sessionType: formData.sessionType,
        assignedUsers: combinedAssignedUsers,
        weeklyDays: formData.frequency === 'Weekly' ? formData.weeklyDays : undefined,
        virtualLocation: formData.sessionType === 'REMOTE' || formData.sessionType === 'HYBRID'
          ? formData.virtualLocation
          : undefined,
        location: locationObj,
        radius: (formData.sessionType === 'PHYSICAL' || formData.sessionType === 'HYBRID') && formData.radius
          ? formData.radius
          : undefined,
        sessionAdmin: isSuperAdmin && formData.sessionAdmin ? formData.sessionAdmin : undefined,
      };

      await api.put(`/api/sessions/${sessionId}`, sessionData);
      navigate('/sessions');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('You are not authorized to edit this session');
      } else if (err.response && err.response.data) {
        if (err.response.data.errors && Array.isArray(err.response.data.errors)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const errorMessages = err.response.data.errors.map((e: any) => e.msg).join(', ');
          setError(errorMessages);
        } else {
          setError(err.response.data.msg || 'Failed to update session');
        }
      } else {
        setError('Failed to update session. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="relative flex min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-[#181511] dark:text-gray-200">
        <div className="layout-container flex h-full grow flex-col">
          <div className="px-4 sm:px-6 lg:px-8 py-12">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
              <div className="flex flex-col gap-2">
                <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                <div className="h-5 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <SkeletonCard variant="card" className="h-48" />
              <SkeletonCard variant="card" className="h-48" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <SkeletonCard variant="card" className="h-48" />
                <SkeletonCard variant="card" className="h-48" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleRemoveUser = (userId: string, mode: 'PHYSICAL' | 'REMOTE' | 'ALL') => {
    if (mode === 'PHYSICAL') {
      setPhysicalUsers(prev => prev.filter(u => u._id !== userId));
    } else if (mode === 'REMOTE') {
      setRemoteUsers(prev => prev.filter(u => u._id !== userId));
    } else {
      setAssignedUsers(prev => prev.filter(u => u._id !== userId));
    }
  };

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="relative flex min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-[#181511] dark:text-gray-200">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-6 lg:px-8 flex flex-1 justify-center py-12">
          <div className="layout-content-container flex flex-col w-full max-w-4xl flex-1 gap-8">
            {/* Page Heading */}
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div className="flex min-w-72 flex-col gap-2">
                <p className="text-4xl font-black leading-tight tracking-[-0.033em] dark:text-white">Edit Session</p>
                <p className="text-base font-normal leading-normal text-gray-500 dark:text-gray-400">Modify the details of your existing session below.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/sessions')}
                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white dark:bg-background-dark dark:border dark:border-gray-700 text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span className="truncate">Back</span>
              </button>
            </div>

            {error && (
              <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center">
                <span className="material-symbols-outlined mr-2">error</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
              {/* Card 1: Basic Details */}
              <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                <h2 className="text-xl font-bold tracking-tight mb-6 dark:text-white">Basic Details</h2>
                <div className="grid grid-cols-1 gap-6">
                  <label className="flex flex-col w-full">
                    <p className="text-sm font-medium leading-normal pb-2 dark:text-gray-300">Class/Batch Name</p>
                    <input
                      ref={nameInputRef}
                      className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-gray-400 dark:placeholder:text-gray-500 p-3 text-base font-normal leading-normal"
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      autoComplete="off"
                      placeholder="e.g., Team Meeting, Training Session"
                    />
                  </label>
                  <label className="flex flex-col w-full">
                    <p className="text-sm font-medium leading-normal pb-2 dark:text-gray-300">Description</p>
                    <textarea
                      className="form-input flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary min-h-32 placeholder:text-gray-400 dark:placeholder:text-gray-500 p-3 text-base font-normal leading-normal"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={3}
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <label className="flex flex-col w-full">
                      <p className="text-sm font-medium leading-normal pb-2 dark:text-gray-300">Start Date</p>
                      <input
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-gray-400 dark:placeholder:text-gray-500 p-3 text-base font-normal leading-normal"
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        required
                      />
                    </label>
                    {formData.frequency !== 'OneTime' && (
                      <label className="flex flex-col w-full">
                        <p className="text-sm font-medium leading-normal pb-2 dark:text-gray-300">End Date</p>
                        <input
                          className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-gray-400 dark:placeholder:text-gray-500 p-3 text-base font-normal leading-normal"
                          type="date"
                          name="endDate"
                          value={formData.endDate}
                          onChange={handleChange}
                          min={formData.startDate}
                        />
                      </label>
                    )}
                    <label className="flex flex-col w-full">
                      <p className="text-sm font-medium leading-normal pb-2 dark:text-gray-300">Start Time</p>
                      <input
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-gray-400 dark:placeholder:text-gray-500 p-3 text-base font-normal leading-normal"
                        type="time"
                        name="startTime"
                        value={formData.startTime}
                        onChange={handleChange}
                        required
                      />
                    </label>
                    <label className="flex flex-col w-full">
                      <p className="text-sm font-medium leading-normal pb-2 dark:text-gray-300">End Time</p>
                      <input
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-gray-400 dark:placeholder:text-gray-500 p-3 text-base font-normal leading-normal"
                        type="time"
                        name="endTime"
                        value={formData.endTime}
                        onChange={handleChange}
                        required
                      />
                    </label>
                  </div>
                  <label className="flex flex-col w-full">
                    <p className="text-sm font-medium leading-normal pb-2 dark:text-gray-300">Frequency</p>
                    <select
                      className="form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 p-3 text-base font-normal leading-normal"
                      name="frequency"
                      value={formData.frequency}
                      onChange={handleChange}
                      required
                    >
                      <option value="OneTime">One-Time</option>
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </label>
                  {formData.frequency === 'Weekly' && (
                    <div className="flex flex-col w-full">
                      <p className="text-sm font-medium leading-normal pb-2 dark:text-gray-300">Repeat on</p>
                      <div className="flex flex-wrap gap-2">
                        {daysOfWeek.map((day, index) => {
                          const isSelected = formData.weeklyDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => handleDayToggle(day)}
                              className={`flex items-center justify-center h-10 w-10 rounded-full border text-sm font-semibold transition-colors ${isSelected
                                ? 'bg-primary text-white border-primary'
                                : 'border-gray-300 dark:border-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
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

              {/* Card 2: Session Mode */}
              <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                <h2 className="text-xl font-bold tracking-tight mb-6 dark:text-white">Session Mode</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      const syntheticEvent = {
                        target: { name: 'sessionType', value: 'PHYSICAL' }
                      } as React.ChangeEvent<HTMLInputElement>;
                      handleChange(syntheticEvent);
                    }}
                    className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 cursor-pointer transition-colors ${formData.sessionType === 'PHYSICAL'
                      ? 'border-primary'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary/50'
                      }`}
                  >
                    {formData.sessionType === 'PHYSICAL' && (
                      <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: '16px' }}>check</span>
                      </div>
                    )}
                    <span className="material-symbols-outlined text-3xl text-gray-600 dark:text-gray-400">groups</span>
                    <p className={`font-semibold ${formData.sessionType === 'PHYSICAL' ? 'text-primary' : 'dark:text-white'}`}>Physical</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const syntheticEvent = {
                        target: { name: 'sessionType', value: 'REMOTE' }
                      } as React.ChangeEvent<HTMLInputElement>;
                      handleChange(syntheticEvent);
                    }}
                    className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 cursor-pointer transition-colors ${formData.sessionType === 'REMOTE'
                      ? 'border-primary'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary/50'
                      }`}
                  >
                    {formData.sessionType === 'REMOTE' && (
                      <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: '16px' }}>check</span>
                      </div>
                    )}
                    <span className="material-symbols-outlined text-3xl text-gray-600 dark:text-gray-400">laptop_chromebook</span>
                    <p className={`font-semibold ${formData.sessionType === 'REMOTE' ? 'text-primary' : 'dark:text-white'}`}>Remote</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const syntheticEvent = {
                        target: { name: 'sessionType', value: 'HYBRID' }
                      } as React.ChangeEvent<HTMLInputElement>;
                      handleChange(syntheticEvent);
                    }}
                    className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 cursor-pointer transition-colors ${formData.sessionType === 'HYBRID'
                      ? 'border-primary'
                      : 'border-gray-300 dark:border-gray-700 hover:border-primary/50'
                      }`}
                  >
                    {formData.sessionType === 'HYBRID' && (
                      <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-white" style={{ fontSize: '16px' }}>check</span>
                      </div>
                    )}
                    <span className={`material-symbols-outlined text-3xl ${formData.sessionType === 'HYBRID' ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`}>hub</span>
                    <p className={`font-semibold ${formData.sessionType === 'HYBRID' ? 'text-primary' : 'dark:text-white'}`}>Hybrid</p>
                  </button>
                </div>
              </div>

              {/* Card 3 & 4: Location/Virtual Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Card 3: Location (Conditional) */}
                {(formData.sessionType === 'PHYSICAL' || formData.sessionType === 'HYBRID') && (
                  <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                    <h2 className="text-xl font-bold tracking-tight mb-6 dark:text-white">Location Details</h2>
                    <div className="flex flex-col gap-6">
                      <div>
                        <p className="text-sm font-medium leading-normal pb-2 dark:text-gray-300">
                          Session Location <span className="text-red-500">*</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowMapPicker(true)}
                          className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 text-gray-700 dark:text-gray-300 hover:border-primary hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors duration-200"
                        >
                          <span className="material-symbols-outlined text-2xl text-primary">map</span>
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
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Click the button above to open an interactive map and select the session location. You can click on the map or search for a location.
                          </p>
                        )}
                      </div>
                      <label className="flex flex-col w-full">
                        <p className="text-sm font-medium leading-normal pb-2 dark:text-gray-300">Radius (meters)</p>
                        <input
                          className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-gray-400 dark:placeholder:text-gray-500 p-3 text-base font-normal leading-normal"
                          type="number"
                          name="radius"
                          value={formData.radius}
                          onChange={handleChange}
                          min="1"
                          required
                          placeholder="Default: 100 meters"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Maximum distance (in meters) from the selected location where attendance can be marked. Default: 100 meters.
                        </p>
                      </label>
                    </div>
                  </div>
                )}

                {/* Card 4: Virtual Details (Conditional) */}
                {(formData.sessionType === 'REMOTE' || formData.sessionType === 'HYBRID') && (
                  <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                    <h2 className="text-xl font-bold tracking-tight mb-6 dark:text-white">Virtual Details</h2>
                    <label className="flex flex-col w-full">
                      <p className="text-sm font-medium leading-normal pb-2 dark:text-gray-300">Virtual Meeting Link</p>
                      <input
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 placeholder:text-gray-400 dark:placeholder:text-gray-500 p-3 text-base font-normal leading-normal"
                        type="url"
                        name="virtualLocation"
                        value={formData.virtualLocation}
                        onChange={handleChange}
                        required={formData.sessionType === 'REMOTE'}
                        placeholder="https://meet.google.com/xyz-abc-def"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Card 5: Attendees */}
              <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold tracking-tight dark:text-white">Assigned Users</h2>
                </div>
                {formData.sessionType === 'HYBRID' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-4">
                      <h3 className="font-semibold dark:text-gray-200">Physical Attendees ({physicalUsers.length})</h3>
                      <div className="flex flex-col gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 min-h-[100px]">
                        {physicalUsers.length > 0 ? (
                          physicalUsers.map(user => (
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
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No physical attendees assigned yet.</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openUserModal('PHYSICAL')}
                        className="flex items-center justify-center rounded-lg h-10 px-4 text-primary text-sm font-bold border-2 border-primary hover:bg-primary/10 transition-colors"
                      >
                        <span className="truncate">{physicalUsers.length > 0 ? `Edit Physical Users (${physicalUsers.length})` : 'Add Physical Users'}</span>
                      </button>
                    </div>
                    <div className="flex flex-col gap-4">
                      <h3 className="font-semibold dark:text-gray-200">Remote Attendees ({remoteUsers.length})</h3>
                      <div className="flex flex-col gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 min-h-[100px]">
                        {remoteUsers.length > 0 ? (
                          remoteUsers.map(user => (
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
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No remote attendees assigned yet.</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openUserModal('REMOTE')}
                        className="flex items-center justify-center rounded-lg h-10 px-4 text-primary text-sm font-bold border-2 border-primary hover:bg-primary/10 transition-colors"
                      >
                        <span className="truncate">{remoteUsers.length > 0 ? `Edit Remote Users (${remoteUsers.length})` : 'Add Remote Users'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 min-h-[100px]">
                      {assignedUsers.length > 0 ? (
                        assignedUsers.map(user => (
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
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No users assigned yet.</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openUserModal('ALL')}
                      className="flex items-center justify-center rounded-lg h-10 px-4 text-primary text-sm font-bold border-2 border-primary hover:bg-primary/10 transition-colors"
                    >
                      <span className="truncate">{assignedUsers.length > 0 ? `Edit Users (${assignedUsers.length})` : 'Add Users'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Card 6: Administration (Conditional) */}
              {isSuperAdmin && (
                <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                  <h2 className="text-xl font-bold tracking-tight mb-6 dark:text-white">Administration</h2>
                  <label className="flex flex-col w-full max-w-sm">
                    <p className="text-sm font-medium leading-normal pb-2 dark:text-gray-300">Session Admin</p>
                    <select
                      className="form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#181511] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-primary h-12 p-3 text-base font-normal leading-normal"
                      name="sessionAdmin"
                      value={formData.sessionAdmin}
                      onChange={handleChange}
                    >
                      <option value="">None</option>
                      {sessionAdmins.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          {admin.profile.firstName} {admin.profile.lastName} ({admin.email})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex flex-col sm:flex-row-reverse items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full sm:w-auto min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary text-white text-base font-bold leading-normal tracking-wide shadow-sm hover:bg-[#d63a25] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="truncate">{isSubmitting ? 'Saving Changes...' : 'Save Changes'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/sessions')}
                  disabled={isSubmitting}
                  className="flex w-full sm:w-auto min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-transparent text-gray-600 dark:text-gray-400 text-base font-bold leading-normal tracking-wide hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="truncate">Cancel</span>
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
      </div>
    </div>
  );
};

export default EditSession;

