import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { downloadBackup, restoreData, downloadStreamBackup } from '../api/backupApi';
import { getBackups, deleteBackup as deleteBackupFromStorage } from '../utils/backupStorage';
import { nowIST, formatIST } from '../utils/time';
import LoadingSpinner from '../components/LoadingSpinner';

interface BackupItem {
  id: string;
  dateKey: string;
  timestamp: number;
  size: number;
  blob: Blob;
}

const DataBackup: React.FC = () => {
  const { user, isCompanyAdmin, isPlatformOwner } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [localBackups, setLocalBackups] = useState<BackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showRestoreConfirmModal, setShowRestoreConfirmModal] = useState(false);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoreBackupDate, setRestoreBackupDate] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get organization ID
  useEffect(() => {
    const fetchOrgId = async () => {
      if (!user?.collectionPrefix) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get('/api/platform/organizations');
        const org = response.data?.organizations?.find(
          (o: any) => o.collectionPrefix === user.collectionPrefix
        );
        if (org?.id) {
          setOrgId(org.id);
        }
      } catch (err) {
        console.warn('Could not fetch organization ID from platform endpoint');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrgId();
  }, [user, isPlatformOwner]);

  // Load local backups for Company Admin only
  useEffect(() => {
    if (!isCompanyAdmin || !user?.collectionPrefix || !orgId) return;

    const loadLocalBackups = async () => {
      try {
        const backups = await getBackups(orgId);
        setLocalBackups(
          backups.map((backup) => ({
            id: backup.id,
            dateKey: backup.dateKey,
            timestamp: backup.timestamp,
            size: backup.size,
            blob: backup.blob,
          }))
        );
      } catch (err) {
        console.error('Error loading local backups:', err);
      }
    };

    loadLocalBackups();
  }, [isCompanyAdmin, user, orgId]);

  // Format date
  const formatDate = (dateKey: string): string => {
    const timestamp = new Date(dateKey).getTime();
    return formatIST(timestamp, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Handle download backup
  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    setError('');
    setSuccessMessage('');

    try {
      const currentTimestamp = nowIST();
      const formattedDate = formatIST(currentTimestamp, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // For Company Admin: Use streaming endpoint (no orgId required)
      // For Platform Owner: Use streaming endpoint with orgId
      if (isCompanyAdmin) {
        // Company Admin: Use context-based streaming (no orgId needed)
        await downloadStreamBackup();
      } else if (isPlatformOwner) {
        // Platform Owner: Use streaming endpoint with orgId if available
        if (orgId) {
          await downloadStreamBackup(orgId);
        } else {
          // Fallback to old endpoint if orgId not available
          if (!user?.collectionPrefix) {
            throw new Error('Organization information not available');
          }
          await downloadBackup(orgId || '', user.collectionPrefix);
        }
      } else {
        throw new Error('Unauthorized access');
      }

      setSuccessMessage(`Backup downloaded successfully! (Date: ${formattedDate})`);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Error downloading backup:', err);
      setError(err.response?.data?.msg || err.message || 'Failed to download backup');
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    if (!file) return;

    // Validate file extension (accept both .gz and .json)
    const fileExt = file.name.toLowerCase();
    if (!fileExt.endsWith('.gz') && !fileExt.endsWith('.json')) {
      setError('Invalid file format. Please select a .gz or .json backup file.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError('');
    setSelectedFile(file);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle restore button click - show confirmation modal
  const handleRestoreButtonClick = () => {
    if (!selectedFile) {
      fileInputRef.current?.click();
      return;
    }

    // Show confirmation modal
    setShowRestoreConfirmModal(true);
    setRestoreConfirmText('');
    setRestoreBackupDate(null);
  };

  // Handle restore confirmation
  const handleRestoreConfirm = async () => {
    if (restoreConfirmText !== 'RESTORE') {
      setError('Please type "RESTORE" exactly to confirm.');
      return;
    }

    if (!selectedFile) {
      setError('No file selected for restore.');
      return;
    }

    setShowRestoreConfirmModal(false);
    setRestoreConfirmText('');
    setIsRestoring(true);
    setError('');
    setSuccessMessage('');

    try {
      // Use context-based restore endpoint (no orgId required)
      // For Platform Owner, pass organizationId if available
      const organizationId = isPlatformOwner && orgId ? orgId : undefined;
      await restoreData(selectedFile, organizationId);

      setSuccessMessage('Data restored successfully.');
      setShowSuccessModal(true);
      setSelectedFile(null);
      setRestoreBackupDate(null);

      // Refresh page after 2 seconds to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      console.error('Error restoring backup:', err);
      setError(err.response?.data?.msg || 'Failed to restore backup');
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle download local backup
  const handleDownloadLocalBackup = async (backup: BackupItem) => {
    try {
      const url = window.URL.createObjectURL(backup.blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup-${user?.collectionPrefix}-${backup.dateKey}.json.gz`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMessage('Backup downloaded successfully!');
      setShowSuccessModal(true);
    } catch (err: any) {
      setError('Failed to download backup');
      console.error('Error downloading local backup:', err);
    }
  };

  // Handle restore from local backup
  const handleRestoreLocalBackup = async (backup: BackupItem) => {
    if (!orgId || !user?.collectionPrefix) {
      setError('Organization ID not available');
      return;
    }

    // Convert blob to File for restore API
    const file = new File([backup.blob], `backup-${backup.dateKey}.json.gz`, { type: 'application/gzip' });
    setSelectedFile(file);
    setRestoreBackupDate(formatDate(backup.dateKey));
    setShowRestoreConfirmModal(true);
    setRestoreConfirmText('');
  };

  // Handle delete local backup
  const handleDeleteLocalBackup = async (backupId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this backup from browser storage?')) {
      return;
    }

    setIsDeleting(backupId);
    setError('');

    try {
      await deleteBackupFromStorage(backupId);

      // Remove from local state
      setLocalBackups(localBackups.filter(b => b.id !== backupId));
      setSuccessMessage('Backup deleted successfully!');
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Error deleting backup:', err);
      setError('Failed to delete backup');
    } finally {
      setIsDeleting(null);
    }
  };

  // Check if user has permission
  if (!isCompanyAdmin && !isPlatformOwner) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">lock</span>
          <p className="text-xl text-gray-700 dark:text-gray-300">You are not authorized to access this page.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8">
          {/* Header */}
          <header className="mb-6 sm:mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary text-4xl sm:text-5xl">cloud_download</span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em]">
                {isPlatformOwner ? 'Manual Backup & Recovery' : 'Organization Data Backup'}
              </h1>
            </div>
            {isPlatformOwner && (
              <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm sm:text-base">
                As Platform Owner, backups are downloaded directly to your computer to save browser storage.
              </p>
            )}
          </header>

          {/* Error/Message Display */}
          {(error || successMessage) && (
            <div className="mb-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}
              {successMessage && !showSuccessModal && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-800 dark:text-green-300">{successMessage}</p>
                </div>
              )}
            </div>
          )}

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Download Card */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-6">
              <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4 flex items-center">
                <span className="material-symbols-outlined text-primary mr-2">download</span>
                Download Backup
              </h3>
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-xs text-green-800 dark:text-green-300 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">info</span>
                  <span>
                    This backup will include data as of <strong>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                  </span>
                </p>
              </div>
              {/* Auto-Backup Status for Company Admins */}
              {isCompanyAdmin && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    <span>Your data is also automatically backed up to this browser daily.</span>
                  </p>
                </div>
              )}
              <button
                onClick={handleDownloadBackup}
                disabled={isDownloading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-[#f04129] text-white rounded-lg font-semibold transition-all duration-200 hover:from-orange-600 hover:to-[#d63a25] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDownloading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                    </svg>
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">download</span>
                    <span>{isPlatformOwner ? 'Generate & Download' : 'Download Backup'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Restore Card */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-6">
              <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4 flex items-center">
                <span className="material-symbols-outlined text-red-500 mr-2">restore</span>
                Restore Database
              </h3>

              {/* Warning Box */}
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-300 flex items-start gap-2">
                  <span className="material-symbols-outlined text-lg flex-shrink-0">warning</span>
                  <span>
                    <strong>Warning:</strong> This will merge imported data with existing records. Duplicates will be updated.
                  </span>
                </p>
              </div>

              {/* Upload Area */}
              <div
                className={`mb-4 p-6 border-2 border-dashed rounded-lg transition-colors ${isDragging
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-border-light dark:border-border-dark hover:border-primary/50'
                  }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.gz"
                  onChange={handleFileInputChange}
                  className="hidden"
                  disabled={isRestoring}
                />

                {selectedFile ? (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-green-500">check_circle</span>
                      <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                        {selectedFile.name}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="material-symbols-outlined text-4xl text-text-secondary-light dark:text-text-secondary-dark mb-2 block">
                      cloud_upload
                    </span>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-2">
                      Drag & drop a backup file here, or
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isRestoring}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      browse to select
                    </button>
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-2">
                      Accepted format: .json or .gz files
                    </p>
                  </div>
                )}
              </div>

              {/* Restore Button */}
              <button
                onClick={handleRestoreButtonClick}
                disabled={isRestoring || !selectedFile}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold transition-all duration-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                    </svg>
                    <span>Restoring...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">upload</span>
                    <span>Upload & Restore</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Local Snapshots Section (Company Admin Only) */}
          {isCompanyAdmin && localBackups.length > 0 && (
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-6">
              <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4 flex items-center">
                <span className="material-symbols-outlined text-primary mr-2">history</span>
                Local Snapshots
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-light dark:border-border-dark">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">Size</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localBackups.map((backup) => (
                      <tr key={backup.id} className="border-b border-border-light dark:border-border-dark hover:bg-surface-dark dark:hover:bg-surface-light transition-colors">
                        <td className="py-3 px-4 text-sm text-text-primary-light dark:text-text-primary-dark">
                          {formatDate(backup.dateKey)}
                        </td>
                        <td className="py-3 px-4 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                          {formatFileSize(backup.size)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDownloadLocalBackup(backup)}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">download</span>
                              Download
                            </button>
                            <button
                              onClick={() => handleRestoreLocalBackup(backup)}
                              disabled={isRestoring}
                              className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">restore</span>
                              Restore
                            </button>
                            <button
                              onClick={() => handleDeleteLocalBackup(backup.id)}
                              disabled={isDeleting === backup.id}
                              className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {isDeleting === backup.id ? (
                                <>
                                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                                  </svg>
                                  <span>Deleting...</span>
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                  Remove from Storage
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success Modal */}
          {showSuccessModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-lg max-w-md w-full p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-green-500 text-4xl">check_circle</span>
                  <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark">Success</h3>
                </div>
                <p className="text-text-secondary-light dark:text-text-secondary-dark mb-6">{successMessage}</p>
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setSuccessMessage('');
                  }}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Restore Confirmation Modal */}
          {showRestoreConfirmModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-lg max-w-md w-full p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-red-500 text-4xl">warning</span>
                  <h3 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark">Confirm Restore</h3>
                </div>
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-300 mb-2">
                    <strong>Warning:</strong> This action will overwrite/merge existing data and cannot be undone.
                  </p>
                  {restoreBackupDate && (
                    <p className="text-sm text-red-800 dark:text-red-300 mb-2">
                      <strong>Backup Date:</strong> {restoreBackupDate}
                    </p>
                  )}
                  {selectedFile && !restoreBackupDate && (
                    <p className="text-sm text-red-800 dark:text-red-300 mb-2">
                      <strong>File:</strong> {selectedFile.name}
                    </p>
                  )}
                  <p className="text-sm text-red-800 dark:text-red-300">
                    To confirm, please type <strong className="font-mono">RESTORE</strong> in the field below:
                  </p>
                </div>
                <input
                  type="text"
                  value={restoreConfirmText}
                  onChange={(e) => setRestoreConfirmText(e.target.value)}
                  placeholder="Type RESTORE to confirm"
                  className="w-full px-4 py-2 border border-border-light dark:border-border-dark rounded-lg bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRestoreConfirmModal(false);
                      setRestoreConfirmText('');
                      setRestoreBackupDate(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRestoreConfirm}
                    disabled={restoreConfirmText !== 'RESTORE'}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirm Restore
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default DataBackup;
