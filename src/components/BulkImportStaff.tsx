import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import api from '../api';

interface BulkImportStaffProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BulkImportStaff: React.FC<BulkImportStaffProps> = ({ isOpen, onClose, onSuccess }) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle CSV file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setCsvFile(file);
    setError('');

    // Parse CSV to preview
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        setCsvPreview(data.slice(0, 5)); // Show first 5 rows as preview
      },
      error: (error) => {
        setError(`Error parsing CSV: ${error.message}`);
        setCsvFile(null);
      },
    });
  };

  // Handle bulk import
  const handleBulkImport = async () => {
    if (!csvFile) {
      setError('Please select a CSV file');
      return;
    }

    // Password is now handled by the backend (default: "Staff@123")
    setIsBulkImporting(true);
    setError('');
    setMessage('');

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];

        // Validate headers
        const headers = Object.keys(data[0] || {});
        const hasFirstName = headers.some(h => h.toLowerCase() === 'firstname');
        const hasLastName = headers.some(h => h.toLowerCase() === 'lastname');
        const hasEmail = headers.some(h => h.toLowerCase() === 'email');
        const hasRole = headers.some(h => h.toLowerCase() === 'role');

        if (!hasFirstName || !hasLastName || !hasEmail || !hasRole) {
          setError('CSV must contain "firstName", "lastName", "email", and "role" columns. Role must be "Manager" or "SessionAdmin" (case-insensitive).');
          setIsBulkImporting(false);
          return;
        }

        // Transform data to match backend format
        const users = data.map((row: any) => {
          const firstNameKey = headers.find(h => h.toLowerCase() === 'firstname') || 'FirstName';
          const lastNameKey = headers.find(h => h.toLowerCase() === 'lastname') || 'LastName';
          const emailKey = headers.find(h => h.toLowerCase() === 'email') || 'Email';
          const roleKey = headers.find(h => h.toLowerCase() === 'role') || 'Role';
          const phoneKey = headers.find(h => h.toLowerCase() === 'phone') || 'Phone';

          const rawRole = row[roleKey]?.trim() || '';
          // Normalize role (case-insensitive): Manager, SessionAdmin, or Session Admin
          let normalizedRole = '';
          if (rawRole.toLowerCase() === 'manager') {
            normalizedRole = 'Manager';
          } else if (rawRole.toLowerCase() === 'sessionadmin' || rawRole.toLowerCase() === 'session admin') {
            normalizedRole = 'SessionAdmin';
          } else {
            normalizedRole = rawRole; // Keep original if valid, will be validated later
          }

          return {
            firstName: row[firstNameKey]?.trim() || '',
            lastName: row[lastNameKey]?.trim() || '',
            email: row[emailKey]?.trim() || '',
            role: normalizedRole,
            phone: row[phoneKey]?.trim() || '',
          };
        }).filter(user => {
          // Filter out empty rows and validate role
          if (!user.firstName || !user.lastName || !user.email || !user.role) {
            return false;
          }
          // Validate role matches 'Manager' or 'SessionAdmin' (case-insensitive)
          const roleLower = user.role.toLowerCase();
          return roleLower === 'manager' || roleLower === 'sessionadmin' || roleLower === 'session admin';
        });

        if (users.length === 0) {
          setError('No valid users found in CSV file');
          setIsBulkImporting(false);
          return;
        }

        try {
          // Use the new staff-specific bulk import endpoint
          const { data: response } = await api.post('/api/users/staff/bulk-import', {
            staff: users, // Send as 'staff' array to match backend expectation
          });

          setMessage(response.msg || `Successfully imported ${response.successCount} staff members`);
          onClose();
          setCsvFile(null);
          setCsvPreview([]);
          onSuccess(); // Refresh the staff list
        } catch (err: any) {
          if (err.response?.data?.errors) {
            const errorMessages = err.response.data.errors.slice(0, 10).join(', ');
            setError(`${err.response.data.msg || 'Bulk import failed'}. Errors: ${errorMessages}${err.response.data.errors.length > 10 ? '...' : ''}`);
          } else {
            setError(err.response?.data?.msg || 'Failed to import staff members. Please try again.');
          }
        } finally {
          setIsBulkImporting(false);
        }
      },
      error: (error) => {
        setError(`Error parsing CSV: ${error.message}`);
        setIsBulkImporting(false);
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-[#e6e2db] dark:border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-[#e6e2db] dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-[#181511] dark:text-white flex items-center">
            <span className="material-symbols-outlined text-[#f04129] mr-2">upload_file</span>
            Import Staff via CSV
          </h3>
          <button
            onClick={() => {
              onClose();
              setCsvFile(null);
              setCsvPreview([]);
              setError('');
              setMessage('');
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="text-[#8a7b60] dark:text-gray-400 hover:text-[#181511] dark:hover:text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Error/Message Display */}
        {(error || message) && (
          <div className="px-6 pt-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}
            {message && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-green-800 dark:text-green-300">{message}</p>
              </div>
            )}
          </div>
        )}

        {/* CSV Format Instructions - Above Grid */}
        <div className="px-6 pt-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 p-3 rounded-md text-sm">
            <p><strong>Required Columns:</strong> firstName, lastName, email, role, phone (optional).</p>
            <p className="mt-1">Note: <strong>Role</strong> must be 'Manager' or 'SessionAdmin' (case-insensitive).</p>
            <button
              type="button"
              onClick={() => {
                const sampleData = [
                  ['firstName', 'lastName', 'email', 'phone', 'role'],
                  ['John', 'Doe', 'john.doe@example.com', '9876543210', 'Manager'],
                  ['Jane', 'Smith', 'jane.smith@example.com', '9123456789', 'SessionAdmin'],
                ];
                const csvContent = sampleData.map(row => row.join(',')).join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', 'staff_import_sample.csv');
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="mt-2 flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Download Sample CSV
            </button>
          </div>
        </div>

        {/* Modal Content - Split View */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Side - File Upload */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-[#181511] dark:text-white">CSV File</h4>
            
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                csvFile
                  ? 'border-[#f04129] bg-[#f04129]/5 dark:bg-[#f04129]/10'
                  : 'border-[#e6e2db] dark:border-slate-700 hover:border-[#f04129] dark:hover:border-[#f04129]'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file && file.name.endsWith('.csv')) {
                  setCsvFile(file);
                  Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                      const data = results.data as any[];
                      setCsvPreview(data.slice(0, 5));
                    },
                    error: (error) => {
                      setError(`Error parsing CSV: ${error.message}`);
                      setCsvFile(null);
                    },
                  });
                } else {
                  setError('Please drop a CSV file');
                }
              }}
            >
              {csvFile ? (
                <div className="space-y-2">
                  <span className="material-symbols-outlined text-4xl text-[#f04129]">description</span>
                  <p className="text-sm font-medium text-[#181511] dark:text-white">{csvFile.name}</p>
                  <p className="text-xs text-[#8a7b60] dark:text-gray-400">{(csvFile.size / 1024).toFixed(2)} KB</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvFile(null);
                      setCsvPreview([]);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="material-symbols-outlined text-4xl text-[#8a7b60] dark:text-gray-400">cloud_upload</span>
                  <p className="text-sm text-[#181511] dark:text-white">Drag & drop CSV file here</p>
                  <p className="text-xs text-[#8a7b60] dark:text-gray-400">or</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-sm font-medium text-[#f04129] border border-[#f04129] rounded-lg hover:bg-[#f04129]/10 dark:hover:bg-[#f04129]/20 transition-colors"
                  >
                    Choose File
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>


            {/* CSV Preview */}
            {csvPreview.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-[#181511] dark:text-white mb-2">Preview (first 5 rows):</p>
                <div className="overflow-x-auto border border-[#e6e2db] dark:border-slate-700 rounded-lg">
                  <table className="min-w-full text-xs">
                    <thead className="bg-[#f04129]/10">
                      <tr>
                        {Object.keys(csvPreview[0] || {}).map((key) => (
                          <th key={key} className="px-2 py-1 text-left font-medium text-[#181511] dark:text-white">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e6e2db] dark:divide-slate-700">
                      {csvPreview.map((row, idx) => (
                        <tr key={idx}>
                          {Object.values(row).map((val: any, i) => (
                            <td key={i} className="px-2 py-1 text-[#8a7b60] dark:text-gray-400">
                              {String(val || '').slice(0, 30)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Side - Info */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-[#181511] dark:text-white">Import Information</h4>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Password Generation:</strong> Each staff member will receive a default password (<code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">Staff@123</code>) via email.
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Note:</strong> Staff members will be required to change their password on first login.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-[#e6e2db] dark:border-slate-700 px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              setCsvFile(null);
              setCsvPreview([]);
              setError('');
              setMessage('');
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            disabled={isBulkImporting}
            className="px-4 py-2 text-sm font-medium text-[#8a7b60] dark:text-gray-400 hover:text-[#181511] dark:hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleBulkImport}
            disabled={!csvFile || isBulkImporting}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-orange-500 to-[#f04129] text-white rounded-lg font-semibold transition-all duration-200 hover:from-orange-600 hover:to-[#d63a25] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isBulkImporting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                </svg>
                <span>Importing...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">upload_file</span>
                <span>Import Staff</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkImportStaff;

