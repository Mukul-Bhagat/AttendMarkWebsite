import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { IClassBatch } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Eye, Calendar, Users, Edit, Trash2 } from 'lucide-react';
import { nowIST, formatIST, sessionTimeToIST, istDayEnd } from '../utils/time';

const Classes: React.FC = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, isCompanyAdmin, isManager, isSessionAdmin, isEndUser, isPlatformOwner } = useAuth();
  const [classes, setClasses] = useState<IClassBatch[]>([]);
  const [sessionCounts, setSessionCounts] = useState<{ [key: string]: number }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirmClass, setDeleteConfirmClass] = useState<IClassBatch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPastClasses, setShowPastClasses] = useState(false);

  // SuperAdmin, CompanyAdmin, Manager, SessionAdmin, and Platform Owner can create classes
  const canCreateClass = isSuperAdmin || isCompanyAdmin || isManager || isSessionAdmin || isPlatformOwner;
  // Same roles can edit and delete classes
  const canEditClass = isSuperAdmin || isCompanyAdmin || isManager || isSessionAdmin || isPlatformOwner;

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const { data } = await api.get('/api/classes');
        setClasses(data || []);

        // Fetch session counts for each class
        const counts: { [key: string]: number } = {};
        await Promise.all(
          (data || []).map(async (classBatch: IClassBatch) => {
            try {
              const sessionsRes = await api.get(`/api/classes/${classBatch._id}/sessions`);
              counts[classBatch._id] = sessionsRes.data.count || 0;
            } catch (err) {
              counts[classBatch._id] = 0;
            }
          })
        );
        setSessionCounts(counts);
      } catch (err: any) {
        console.error('[ERROR] Failed to fetch classes:', err);
        console.error('[ERROR] Response status:', err.response?.status);
        console.error('[ERROR] Response data:', err.response?.data);

        if (err.response?.status === 401) {
          setError('You are not authorized. Please log in again.');
        } else if (err.response?.status === 403) {
          setError('Access denied. You do not have permission to view classes.');
        } else if (err.response?.status === 500) {
          setError('Server error. Please try again later.');
        } else {
          setError(err.response?.data?.msg || err.response?.data?.error || 'Failed to load classes. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchClasses();
  }, []);

  const handleViewClass = (classBatch: IClassBatch) => {
    // Always navigate to session list for this class
    navigate(`/classes/${classBatch._id}/sessions`);
  };

  const handleDeleteClass = async (classBatch: IClassBatch) => {
    setIsDeleting(true);
    try {
      await api.delete(`/api/classes/${classBatch._id}?deleteSessions=true`);
      // Remove from local state
      setClasses(classes.filter(c => c._id !== classBatch._id));
      setDeleteConfirmClass(null);
    } catch (err: any) {
      console.error('Error deleting class:', err);
      setError(err.response?.data?.msg || 'Failed to delete class. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };




  // Check if a class is past (all sessions have ended)
  // A class is only "Past" if its very last session has finished
  const isClassPast = (classBatch: IClassBatch): boolean => {
    // Use latestSessionDate if available (calculated from all sessions)
    if (classBatch.latestSessionDate) {
      const latestSessionEnd = istDayEnd(classBatch.latestSessionDate); // Assuming latestSessionDate refers to a day.
      const now = nowIST();
      // Class is past if latestSessionDate is before now
      return latestSessionEnd < now;
    }

    // Fallback: If latestSessionDate is not available, use firstSession logic
    // (This should not happen if backend is working correctly, but provides backward compatibility)
    const firstSession = classBatch.firstSession;
    if (!firstSession || !firstSession.endDate) {
      // If no endDate, check startDate
      if (firstSession?.startDate) {
        const sessionEndTimestamp = sessionTimeToIST(firstSession.startDate, firstSession.endTime);
        const now = nowIST();
        return sessionEndTimestamp < now;
      }
      return false;
    }

    const endDateTimestamp = sessionTimeToIST(firstSession.endDate, firstSession.endTime);
    const now = nowIST();
    return endDateTimestamp < now;
  };

  // Format frequency for badge
  const formatFrequency = (frequency?: string) => {
    if (!frequency) return 'N/A';
    const freqMap: { [key: string]: string } = {
      OneTime: 'One Time',
      Daily: 'Daily',
      Weekly: 'Weekly',
      Monthly: 'Monthly',
    };
    return freqMap[frequency] || frequency;
  };

  if (isLoading) {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
        <div className="layout-container flex h-full grow flex-col">
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em]">Classes/Batches</h1>
              {canCreateClass && (
                <Link
                  to="/classes/create"
                  className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-5 bg-gradient-to-r from-orange-500 to-[#f04129] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:from-orange-600 hover:to-[#d63a25] transition-all"
                >
                  <span className="material-symbols-outlined text-xl">add</span>
                  <span className="truncate">Create New Class</span>
                </Link>
              )}
            </header>
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center">
                <svg className="animate-spin h-8 w-8 text-[#f04129] mb-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                </svg>
                <p className="text-[#8a7b60] dark:text-gray-400">Loading classes/batches...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
        <div className="layout-container flex h-full grow flex-col">
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em]">Classes/Batches</h1>
              {canCreateClass && (
                <Link
                  to="/classes/create"
                  className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-5 bg-gradient-to-r from-orange-500 to-[#f04129] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:from-orange-600 hover:to-[#d63a25] transition-all"
                >
                  <span className="material-symbols-outlined text-xl">add</span>
                  <span className="truncate">Create New Class</span>
                </Link>
              )}
            </header>
            <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center">
              <span className="material-symbols-outlined mr-2">error</span>
              {error}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#f04129] text-4xl">class</span>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em]">Classes/Batches</h1>
            </div>
            {canCreateClass && (
              <Link
                to="/classes/create"
                className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-5 bg-gradient-to-r from-orange-500 to-[#f04129] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:from-orange-600 hover:to-[#d63a25] transition-all"
              >
                <span className="material-symbols-outlined text-xl">add</span>
                <span className="truncate">Create New Class</span>
              </Link>
            )}
          </header>

          {/* Show Past Classes Toggle */}
          {classes.length > 0 && (
            <div className="mb-4 flex items-center justify-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPastClasses}
                  onChange={(e) => setShowPastClasses(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-[#f04129] focus:ring-[#f04129] focus:ring-offset-0"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">Show Past Classes</span>
              </label>
            </div>
          )}

          {classes.length === 0 ? (
            <div className="mt-12 md:col-span-2 lg:col-span-3">
              <div className="flex flex-col items-center gap-6 rounded-xl border-2 border-dashed border-[#e6e2db] dark:border-slate-800 px-6 py-14">
                <div className="flex max-w-[480px] flex-col items-center gap-2 text-center">
                  <p className="text-[#181511] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">No Classes/Batches Available</p>
                  <p className="text-[#181511] dark:text-slate-300 text-sm font-normal leading-normal">
                    {isEndUser
                      ? "You are not currently assigned to any classes/batches. Please contact your administrator if you believe this is an error."
                      : "There are currently no classes/batches scheduled. Get started by creating a new one."}
                  </p>
                </div>
                {canCreateClass && (
                  <Link
                    to="/classes/create"
                    className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-5 bg-gradient-to-r from-orange-500 to-[#f04129] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:from-orange-600 hover:to-[#d63a25] transition-all"
                  >
                    <span className="material-symbols-outlined text-xl">add</span>
                    <span className="truncate">Create New Class</span>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 p-4 md:p-0">
              {classes
                .filter((classBatch) => {
                  // Filter past classes based on toggle
                  if (!showPastClasses && isClassPast(classBatch)) {
                    return false;
                  }
                  return true;
                })
                .sort((a, b) => {
                  // Sort: Active classes first, then past classes
                  const aIsPast = isClassPast(a);
                  const bIsPast = isClassPast(b);
                  if (aIsPast && !bIsPast) return 1;
                  if (!aIsPast && bIsPast) return -1;
                  return 0;
                })
                .map((classBatch) => {
                  const firstSession = classBatch.firstSession;
                  const isPast = isClassPast(classBatch);

                  return (
                    <div
                      key={classBatch._id}
                      className={`flex flex-col w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md p-4 md:p-6 transition-shadow cursor-pointer ${isPast ? 'opacity-60' : ''
                        }`}
                      onClick={() => handleViewClass(classBatch)}
                    >
                      <div className="flex items-start justify-between mb-4 gap-2">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white break-words flex-1">{classBatch.name}</h2>
                        {canEditClass && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/classes/edit/${classBatch._id}`);
                              }}
                              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              title="Edit Class"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmClass(classBatch);
                              }}
                              className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Delete Class"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {classBatch.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 pt-1 break-words whitespace-normal mb-4">
                          {classBatch.description}
                        </p>
                      )}

                      <div className="flex-grow space-y-3 text-slate-700 dark:text-slate-300 mb-4">
                        {firstSession?.frequency && (
                          <div className="flex items-center text-sm">
                            <span className="whitespace-nowrap rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                              {formatFrequency(firstSession.frequency)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center text-sm">
                          <Users className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                          <span className="break-words whitespace-normal font-medium">
                            {sessionCounts[classBatch._id] || 0} Session{sessionCounts[classBatch._id] !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {firstSession && (
                          <div className="flex items-center text-sm">
                            <Calendar className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                            <span className="break-words whitespace-normal">
                              {isPast ? 'Ended' : 'Next'}: {formatIST(sessionTimeToIST(firstSession.startDate, firstSession.startTime), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-auto">
                        <button
                          className="flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-3 md:px-4 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewClass(classBatch);
                          }}
                        >
                          <Eye className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                          <span className="truncate whitespace-normal">View Sessions</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Delete Class
            </h3>
            <p className="text-slate-700 dark:text-slate-300 mb-6">
              Are you sure you want to delete <strong>"{deleteConfirmClass.name}"</strong>?
              This will permanently delete the class and <strong>all associated sessions</strong>.
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmClass(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteClass(deleteConfirmClass)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Classes;

