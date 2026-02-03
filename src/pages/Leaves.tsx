import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { X, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { nowIST, toISTDateString, formatIST, istDayStart, istDayEnd } from '../utils/time';

interface ILeaveRequest {
  _id: string;
  userId: string | {
    _id: string;
    email: string;
    profile: {
      firstName: string;
      lastName: string;
    };
  };
  leaveType: 'Personal' | 'Casual' | 'Sick' | 'Extra';
  startDate: string;
  endDate: string;
  dates?: string[]; // Array of specific dates (for non-consecutive dates)
  daysCount: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string | {
    _id: string;
    email: string;
    profile: {
      firstName: string;
      lastName: string;
    };
  };
  rejectionReason?: string;
  attachment?: string; // File path/URL for attached document
  organizationPrefix: string;
  createdAt: string;
  updatedAt?: string;
  balance?: {
    quota: { pl: number; cl: number; sl: number };
    used: { Personal: number; Casual: number; Sick: number; Extra: number };
    remaining: { Personal: number; Casual: number; Sick: number };
  };
}

interface IUser {
  _id: string;
  email: string;
  role: string;
  profile: {
    firstName: string;
    lastName: string;
  };
}

interface IQuota {
  yearlyQuotaPL: number;
  yearlyQuotaCL: number;
  yearlyQuotaSL: number;
}

interface IActiveLeave {
  _id: string;
  userName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
}

const Leaves: React.FC = () => {
  const { user, isSuperAdmin, isCompanyAdmin, isManager, isSessionAdmin } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<ILeaveRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ILeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quota, setQuota] = useState<IQuota>({ yearlyQuotaPL: 12, yearlyQuotaCL: 12, yearlyQuotaSL: 10 });
  const [activeLeaves, setActiveLeaves] = useState<IActiveLeave[]>([]);
  const [staffUsers, setStaffUsers] = useState<IUser[]>([]);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Rejection modal state
  const [rejectionModal, setRejectionModal] = useState<{ isOpen: boolean; leaveId: string | null; userName: string }>({
    isOpen: false,
    leaveId: null,
    userName: '',
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessingRejection, setIsProcessingRejection] = useState(false);

  // Leave Details Modal state
  const [selectedLeave, setSelectedLeave] = useState<ILeaveRequest | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Check if user is Admin/Staff
  const isAdminOrStaff = isSuperAdmin || isCompanyAdmin || isManager || isSessionAdmin;

  // Form state
  const [formData, setFormData] = useState({
    subject: '',
    leaveType: 'Personal' as 'Personal' | 'Casual' | 'Sick' | 'Extra',
    reason: '',
    sendTo: [] as string[], // Array of user IDs
  });
  const [isSendToDropdownOpen, setIsSendToDropdownOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to normalize leave data
  const normalizeLeaves = (data: any): ILeaveRequest[] => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.leaves)) return data.leaves;
    return [];
  };

  // Centralized data fetcher
  const fetchLeaveData = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      // Fetch user's leaves
      const { data: leavesResponse } = await api.get('/api/leaves/my-leaves');
      const normalized = normalizeLeaves(leavesResponse);
      setLeaveRequests(normalized);

      // Handle quota from response or fallback
      if (!Array.isArray(leavesResponse) && leavesResponse?.quota) {
        setQuota({
          yearlyQuotaPL: leavesResponse.quota.pl || 12,
          yearlyQuotaCL: leavesResponse.quota.cl || 12,
          yearlyQuotaSL: leavesResponse.quota.sl || 10,
        });
      } else {
        // Fallback: Try to fetch organization settings for quota
        try {
          const { data: settings } = await api.get('/api/organization/settings');
          if (settings) {
            setQuota({
              yearlyQuotaPL: settings.yearlyQuotaPL || 12,
              yearlyQuotaCL: settings.yearlyQuotaCL || 12,
              yearlyQuotaSL: settings.yearlyQuotaSL || 10,
            });
          }
        } catch (err) {
          console.log('Using default quota values');
        }
      }

      // If Admin/Staff, fetch organization pending requests
      if (isAdminOrStaff) {
        try {
          const { data: orgLeaves } = await api.get('/api/leaves/organization?status=Pending');
          setPendingRequests(normalizeLeaves(orgLeaves));

          // Fetch active leaves today
          const { data: activeToday } = await api.get('/api/leaves/active-today');
          setActiveLeaves(Array.isArray(activeToday) ? activeToday : []);
        } catch (err) {
          console.error('Failed to fetch pending requests:', err);
          setPendingRequests([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch leaves:', err);
      setLeaveRequests(prev => Array.isArray(prev) ? prev : []);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  // Fetch leave requests and quota
  useEffect(() => {
    if (user) {
      fetchLeaveData(true);
    } else {
      setIsLoading(false);
    }
  }, [user, isAdminOrStaff]);

  // Fetch staff users for "Send To" dropdown
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const { data: users } = await api.get('/api/users/my-organization');
        // Filter for Admins/Staff (SuperAdmin, CompanyAdmin, Manager, SessionAdmin)
        const staff = users.filter((u: IUser) =>
          ['SuperAdmin', 'CompanyAdmin', 'Manager', 'SessionAdmin'].includes(u.role)
        );
        setStaffUsers(staff);
      } catch (err) {
        console.error('Failed to fetch staff:', err);
      }
    };

    if (isModalOpen) {
      fetchStaff();
    }
  }, [isModalOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isSendToDropdownOpen && !target.closest('.send-to-dropdown-container')) {
        setIsSendToDropdownOpen(false);
      }
    };

    if (isSendToDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSendToDropdownOpen]);

  // Calculate used leaves for current year
  const getUsedLeaves = (type: 'Personal' | 'Casual' | 'Sick') => {
    const currentYear = new Date(nowIST()).getFullYear();
    const leaves = Array.isArray(leaveRequests) ? leaveRequests : [];
    return leaves
      .filter(leave => {
        const leaveYear = new Date(leave.startDate).getFullYear();
        return leave.leaveType === type &&
          leave.status === 'Approved' &&
          leaveYear === currentYear;
      })
      .reduce((sum, leave) => sum + leave.daysCount, 0);
  };

  // Calculate disabled dates (already applied leaves)
  const disabledDates = React.useMemo(() => {
    const dates: Date[] = [];
    if (!Array.isArray(leaveRequests)) return dates;

    leaveRequests.forEach(leave => {
      // Filter for Pending/Approved only (status can only be 'Pending' | 'Approved' | 'Rejected')
      if (leave.status !== 'Pending' && leave.status !== 'Approved') return;

      if (leave.dates && leave.dates.length > 0) {
        leave.dates.forEach(d => dates.push(new Date(istDayStart(d))));
      } else if (leave.startDate && leave.endDate) {
        let currentTimestamp = istDayStart(leave.startDate);
        const endTimestamp = istDayEnd(leave.endDate);
        // 24 hours in milliseconds
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        while (currentTimestamp <= endTimestamp) {
          dates.push(new Date(currentTimestamp));
          currentTimestamp += ONE_DAY_MS;
        }
      }
    });
    return dates;
  }, [leaveRequests]);

  const usedPL = getUsedLeaves('Personal');
  const usedCL = getUsedLeaves('Casual');
  const usedSL = getUsedLeaves('Sick');

  const remainingPL = quota.yearlyQuotaPL - usedPL;
  const remainingCL = quota.yearlyQuotaCL - usedCL;
  const remainingSL = quota.yearlyQuotaSL - usedSL;

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validate form
  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!formData.subject.trim()) {
      errors.subject = 'Subject is required';
    }

    if (selectedDates.length === 0) {
      errors.dates = 'Please select at least one date';
    }

    if (!formData.reason.trim()) {
      errors.reason = 'Reason is required';
    }

    if (!formData.sendTo || formData.sendTo.length === 0) {
      errors.sendTo = 'Please select at least one recipient';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Convert selected dates to ISO strings (YYYY-MM-DD format)
      const datesArray = selectedDates
        .sort((a, b) => a.getTime() - b.getTime())
        .map(date => toISTDateString(istDayStart(date.toISOString())));

      // Create FormData for file upload
      const formDataToSend = new FormData();
      formDataToSend.append('leaveType', formData.leaveType);
      formDataToSend.append('dates', JSON.stringify(datesArray));
      formDataToSend.append('reason', formData.reason);

      // Append sendTo as array
      if (formData.sendTo && formData.sendTo.length > 0) {
        formDataToSend.append('sendTo', JSON.stringify(formData.sendTo));
      }

      // Append file if selected
      if (selectedFile) {
        formDataToSend.append('attachment', selectedFile);
      }

      await api.post('/api/leaves', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Refresh data
      await fetchLeaveData(false);

      // Show success toast
      setToast({ message: 'Leave request submitted successfully', type: 'success' });

      // Reset form and close modal
      setFormData({
        subject: '',
        leaveType: 'Personal',
        reason: '',
        sendTo: [],
      });
      setSelectedDates([]);
      setSelectedFile(null);
      setFormErrors({});
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to submit leave request:', err);
      const errorMsg = err.response?.data?.msg || err.response?.data?.errors?.[0]?.msg || 'Failed to submit leave request';
      setFormErrors({ submit: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get role display name
  const getRoleDisplayName = (role: string): string => {
    const roleMap: { [key: string]: string } = {
      'SuperAdmin': 'Company Administrator',
      'CompanyAdmin': 'Company Administrator',
      'SessionAdmin': 'Company Admin',
      'Manager': 'Manager',
      'EndUser': 'End User',
    };
    return roleMap[role] || role;
  };

  // Handle sendTo selection
  const handleSendToToggle = (userId: string) => {
    setFormData(prev => {
      const currentSendTo = prev.sendTo || [];
      if (currentSendTo.includes(userId)) {
        // Remove from selection
        return { ...prev, sendTo: currentSendTo.filter(id => id !== userId) };
      } else {
        // Add to selection
        return { ...prev, sendTo: [...currentSendTo, userId] };
      }
    });
    // Clear error when user makes a selection
    if (formErrors.sendTo) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.sendTo;
        return newErrors;
      });
    }
  };

  // Remove a selected recipient
  const handleRemoveRecipient = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      sendTo: (prev.sendTo || []).filter(id => id !== userId)
    }));
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const timestamp = new Date(dateString).getTime();
      if (isNaN(timestamp)) {
        return dateString;
      }
      return formatIST(timestamp, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Format date range
  // Format date range
  const formatDateRange = (start: string, end: string, dates?: string[]) => {
    let startTime = istDayStart(start);
    let endTime = istDayEnd(end);
    let isConsecutive = true;
    let count = 0;

    if (dates && dates.length > 0) {
      const sorted = dates.map(d => istDayStart(d)).sort((a, b) => a - b);
      startTime = sorted[0];
      endTime = sorted[sorted.length - 1];
      count = sorted.length;

      // Check consecutive
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const diffDays = Math.round((endTime - startTime) / ONE_DAY_MS) + 1;
      isConsecutive = diffDays === count;
    }

    const startDateFormatted = formatIST(startTime, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const endDateFormatted = formatIST(endTime, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    if (startDateFormatted === endDateFormatted) {
      return startDateFormatted;
    }

    if (!isConsecutive && count > 0) {
      return `${startDateFormatted} - ${endDateFormatted} (${count} days)`;
    }

    return `${startDateFormatted} - ${endDateFormatted}`;
  };

  // Format dates list for tooltip
  const formatDatesList = (dates?: string[]) => {
    if (!dates || dates.length === 0) return '';
    return dates
      .sort()
      .map(date => formatDate(date))
      .join(', ');
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'Pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'Rejected':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  // Get user name from leave request
  const getUserName = (leave: ILeaveRequest): string => {
    if (typeof leave.userId === 'object' && leave.userId.profile) {
      if (leave.userId.profile.firstName && leave.userId.profile.lastName) {
        return `${leave.userId.profile.firstName} ${leave.userId.profile.lastName}`;
      }
      if (leave.userId.profile.firstName) {
        return leave.userId.profile.firstName;
      }
      if (leave.userId.email) {
        return leave.userId.email;
      }
    }
    return '';
  };


  // Handle reject leave (open modal)
  const handleRejectClick = (leaveId: string) => {
    const leave = pendingRequests.find(l => l._id === leaveId);
    const userName = leave ? getUserName(leave) : '';
    setRejectionModal({
      isOpen: true,
      leaveId,
      userName,
    });
    setRejectionReason('');
  };

  // Handle reject leave (submit)
  const handleRejectSubmit = async () => {
    if (!rejectionModal.leaveId || !rejectionReason.trim()) {
      setToast({ message: 'Please provide a rejection reason', type: 'error' });
      return;
    }

    try {
      setIsProcessingRejection(true);
      await api.put(`/api/leaves/${rejectionModal.leaveId}/status`, {
        status: 'Rejected',
        rejectionReason: rejectionReason.trim(),
      });

      // Show success toast
      setToast({ message: `Leave rejected for ${rejectionModal.userName}`, type: 'success' });

      // Close modal
      setRejectionModal({ isOpen: false, leaveId: null, userName: '' });
      setRejectionReason('');

      // Refresh data
      await fetchLeaveData(false);
    } catch (err: any) {
      console.error('Failed to reject leave:', err);
      const errorMsg = err.response?.data?.msg || 'Failed to reject leave';
      setToast({ message: errorMsg, type: 'error' });
    } finally {
      setIsProcessingRejection(false);
    }
  };

  // Handle opening leave details modal
  const handleOpenDetails = (leave: ILeaveRequest) => {
    setSelectedLeave(leave);
    setIsDetailsModalOpen(true);
  };

  // Handle closing leave details modal
  const handleCloseDetails = () => {
    setIsDetailsModalOpen(false);
    setSelectedLeave(null);
  };

  // Generate PDF for leave application
  const generateLeavePDF = (leave: ILeaveRequest) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    // Header - Organization Name (Centered, Large, Bold)
    // Use organizationPrefix from leave, or fallback to 'Leave Application'
    const orgName = leave.organizationPrefix || 'Leave Application';
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    const orgNameWidth = pdf.getTextWidth(orgName);
    const orgNameX = (pageWidth - orgNameWidth) / 2;
    pdf.text(orgName, orgNameX, yPos);
    yPos += 15;

    // Draw line
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // Applicant Information
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Applicant Information', margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    // Get applicant name - handle multiple cases with improved fallback
    let applicantName: string;
    if (typeof leave.userId === 'object' && leave.userId.profile) {
      // userId is populated object - check if firstName exists
      if (leave.userId.profile.firstName && leave.userId.profile.lastName) {
        applicantName = `${leave.userId.profile.firstName} ${leave.userId.profile.lastName}`;
      } else if (user?.profile?.firstName && user?.profile?.lastName) {
        // Fallback to current user if userId profile is incomplete
        applicantName = `${user.profile.firstName} ${user.profile.lastName}`;
      } else {
        applicantName = 'N/A';
      }
    } else if (typeof leave.userId === 'string') {
      // userId is just an ID string - check if it matches current user
      if (user && leave.userId === user.id) {
        // User is viewing their own leave - use AuthContext user data
        applicantName = `${user.profile.firstName} ${user.profile.lastName}`;
      } else {
        // Viewing someone else's leave - show ID
        applicantName = `Employee ID: ${leave.userId}`;
      }
    } else {
      // Fallback to current user
      applicantName = (user?.profile?.firstName && user?.profile?.lastName)
        ? `${user.profile.firstName} ${user.profile.lastName}`
        : 'N/A';
    }

    // Get applicant email - handle multiple cases with improved fallback
    let applicantEmail: string;
    if (typeof leave.userId === 'object' && leave.userId.email) {
      // userId is populated object
      applicantEmail = leave.userId.email;
    } else if (typeof leave.userId === 'object' && !leave.userId.email && user?.email) {
      // userId is object but email missing - fallback to current user
      applicantEmail = user.email;
    } else if (typeof leave.userId === 'string') {
      // userId is ID string - check if it matches current user
      if (user && leave.userId === user.id) {
        applicantEmail = user.email;
      } else {
        // Fallback to current user email or N/A
        applicantEmail = user?.email || 'N/A';
      }
    } else {
      // Fallback to current user email
      applicantEmail = user?.email || 'N/A';
    }

    pdf.text(`Name: ${applicantName}`, margin, yPos);
    yPos += 6;
    pdf.text(`Email: ${applicantEmail}`, margin, yPos);
    yPos += 10;

    // Leave Details
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Leave Details', margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Leave Type: ${leave.leaveType}`, margin, yPos);
    yPos += 6;

    const dateRange = formatDateRange(leave.startDate, leave.endDate, leave.dates);
    pdf.text(`Date Range: ${dateRange}`, margin, yPos);
    yPos += 6;

    pdf.text(`Duration: ${leave.daysCount} ${leave.daysCount === 1 ? 'day' : 'days'}`, margin, yPos);
    yPos += 6;

    // Status Section
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Status', margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Status: ${leave.status}`, margin, yPos);
    yPos += 6;

    // Approval Date and Approved By (only for Approved status)
    if (leave.status === 'Approved') {
      if (leave.updatedAt) {
        const approvedDate = formatIST(new Date(leave.updatedAt).getTime(), {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        pdf.text(`Approved Date: ${approvedDate}`, margin, yPos);
        yPos += 6;
      }

      if (leave.approvedBy) {
        const approverName = typeof leave.approvedBy === 'object'
          ? `${leave.approvedBy.profile.firstName} ${leave.approvedBy.profile.lastName}`
          : 'N/A';
        pdf.text(`Approved By: ${approverName}`, margin, yPos);
        yPos += 6;
      }
    }
    yPos += 10;

    // Reason
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Reason', margin, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const reasonLines = pdf.splitTextToSize(leave.reason || 'N/A', pageWidth - 2 * margin);
    reasonLines.forEach((line: string) => {
      pdf.text(line, margin, yPos);
      yPos += 6;
    });
    yPos += 10;

    // Rejection Information (only for Rejected status)
    if (leave.status === 'Rejected' && leave.approvedBy) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Rejection Information', margin, yPos);
      yPos += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const rejectorName = typeof leave.approvedBy === 'object'
        ? `${leave.approvedBy.profile.firstName} ${leave.approvedBy.profile.lastName}`
        : 'N/A';
      pdf.text(`Rejected By: ${rejectorName}`, margin, yPos);
      yPos += 6;

      if (leave.updatedAt) {
        const rejectedDate = formatIST(new Date(leave.updatedAt).getTime());
        pdf.text(`Rejected On: ${rejectedDate}`, margin, yPos);
        yPos += 6;
      }

      if (leave.rejectionReason) {
        pdf.text(`Reason: ${leave.rejectionReason}`, margin, yPos);
        yPos += 6;
      }
      yPos += 10;
    }

    // Save PDF
    const fileName = `Leave_Application_${leave._id}_${toISTDateString(nowIST())}.pdf`;
    pdf.save(fileName);
  };

  // Handle delete leave request
  const handleDeleteLeave = async (leaveId: string) => {
    // Show confirmation dialog
    const confirmed = window.confirm('Are you sure you want to delete this leave request? This action cannot be undone.');

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/api/leaves/${leaveId}`);

      // Show success toast
      setToast({ message: 'Leave request deleted successfully', type: 'success' });

      // Refresh all data to ensure consistency
      await fetchLeaveData(false);
    } catch (err: any) {
      console.error('Failed to delete leave:', err);
      const errorMsg = err.response?.data?.msg || 'Failed to delete leave request';
      setToast({ message: errorMsg, type: 'error' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-8 w-8 text-primary mb-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
          </svg>
          <p className="text-text-secondary-light dark:text-text-secondary-dark">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-10">
      {/* Header */}
      <div className="flex flex-wrap justify-between gap-3 mb-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black leading-tight tracking-[-0.033em] text-text-primary-light dark:text-text-primary-dark">
            Leave Management
          </h1>
          <p className="text-base font-normal text-text-secondary-light dark:text-text-secondary-dark">
            Manage your leave requests and track your leave balance.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-[#f04129] hover:bg-[#d63a25] text-white font-bold rounded-lg transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined">add</span>
          Apply Leave
        </button>
      </div>

      {/* Quota Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-6">
        {/* Personal Leave Card */}
        <div className="flex min-w-[158px] flex-1 flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#f04129] text-xl">event</span>
            <p className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">Personal Leave</p>
          </div>
          <p className="tracking-light text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            Remaining: {remainingPL} / Total: {quota.yearlyQuotaPL}
          </p>
        </div>

        {/* Casual Leave Card */}
        <div className="flex min-w-[158px] flex-1 flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#f04129] text-xl">calendar_today</span>
            <p className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">Casual Leave</p>
          </div>
          <p className="tracking-light text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            Remaining: {remainingCL} / Total: {quota.yearlyQuotaCL}
          </p>
        </div>

        {/* Sick Leave Card */}
        <div className="flex min-w-[158px] flex-1 flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#f04129] text-xl">local_hospital</span>
            <p className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">Sick Leave</p>
          </div>
          <p className="tracking-light text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            Remaining: {remainingSL} / Total: {quota.yearlyQuotaSL}
          </p>
        </div>
      </div>

      {/* Currently on Leave Section - Only for Admins/Staff */}
      {isAdminOrStaff && activeLeaves.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#f04129]">beach_access</span>
            <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
              Currently on Leave
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeLeaves.map(leave => (
              <div key={leave._id} className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                  {leave.userName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-primary-light dark:text-text-primary-dark truncate" title={leave.userName}>
                    {leave.userName}
                  </p>
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate">
                    {leave.leaveType} • <span className="text-green-600 dark:text-green-400 font-medium">Active Today</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Requests Section - Only for Admins/Staff */}
      {isAdminOrStaff && (
        <div className="w-full rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm mb-6">
          <h2 className="text-xl font-bold mb-4 text-text-primary-light dark:text-text-primary-dark">
            Pending Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
          </h2>
          <div className="flex flex-col gap-4">
            {pendingRequests.length > 0 ? (
              pendingRequests.map((leave) => (
                <div
                  key={leave._id}
                  onClick={() => handleOpenDetails(leave)}
                  className="relative flex flex-col sm:flex-row gap-2 sm:gap-4 p-3 sm:p-5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark hover:bg-gray-50 dark:hover:bg-surface-dark/50 transition-colors cursor-pointer"
                >
                  {/* User Avatar */}
                  {typeof leave.userId === 'object' && leave.userId.profile && (
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#f04129]/20 flex items-center justify-center">
                        <span className="text-[#f04129] text-sm sm:text-base font-bold">
                          {leave.userId.profile.firstName?.[0]?.toUpperCase() || ''}
                          {leave.userId.profile.lastName?.[0]?.toUpperCase() || ''}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Main Content */}
                  <div className="flex flex-col gap-1 sm:gap-2 flex-1 min-w-0 pr-12 sm:pr-0">
                    {/* User Name - if available */}
                    {typeof leave.userId === 'object' && leave.userId.profile && (
                      <p className="text-sm sm:text-base font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                        {leave.userId.profile.firstName} {leave.userId.profile.lastName}
                      </p>
                    )}

                    {/* Date Range */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm sm:text-base font-semibold text-text-primary-light dark:text-text-primary-dark break-words">
                        {formatDateRange(leave.startDate, leave.endDate, leave.dates)}
                      </p>
                      {leave.dates && leave.dates.length > 0 && (
                        <span
                          className="text-xs text-text-secondary-light dark:text-text-secondary-dark cursor-help whitespace-nowrap"
                          title={formatDatesList(leave.dates)}
                        >
                          (Multiple Dates)
                        </span>
                      )}
                    </div>

                    {/* Leave Type and Days */}
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark break-words">
                      {leave.leaveType} • {leave.daysCount} {leave.daysCount === 1 ? 'day' : 'days'}
                    </p>
                  </div>

                  {/* Status Badge and Chevron - Top Right on Mobile, Right Side on Desktop */}
                  <div className="absolute top-3 right-3 sm:relative sm:top-0 sm:right-0 flex sm:flex-col sm:items-end items-center gap-2 sm:gap-3 flex-shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(leave.status)}`}>
                      {leave.status}
                    </span>
                    <span className="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark text-lg">
                      chevron_right
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm py-4">
                No pending leave requests.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Leave History */}
      <div className="w-full rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
        <h2 className="text-xl font-bold mb-4 text-text-primary-light dark:text-text-primary-dark">Leave History</h2>
        <div className="flex flex-col gap-4">
          {leaveRequests.length > 0 ? (
            leaveRequests.map((leave) => (
              <div
                key={leave._id}
                onClick={() => handleOpenDetails(leave)}
                className="flex items-center justify-between p-4 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark hover:bg-gray-50 dark:hover:bg-surface-dark/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text-primary-light dark:text-text-primary-dark">
                        {formatDateRange(leave.startDate, leave.endDate, leave.dates)}
                      </p>
                      {leave.dates && leave.dates.length > 0 && (
                        <span
                          className="text-xs text-text-secondary-light dark:text-text-secondary-dark cursor-help"
                          title={formatDatesList(leave.dates)}
                        >
                          (Multiple Dates)
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      {leave.leaveType} • {leave.daysCount} {leave.daysCount === 1 ? 'day' : 'days'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(leave.status)}`}>
                    {leave.status}
                  </span>
                  {/* Delete button - only show for Pending leaves */}
                  {leave.status === 'Pending' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLeave(leave._id);
                      }}
                      className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                      title="Delete Leave Request"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm py-4">
              No leave requests found.
            </p>
          )}
        </div>
      </div>

      {/* Apply Leave Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl w-full max-w-5xl max-w-[95vw] mx-4 max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-border-light dark:border-border-dark flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
                  Apply for Leave
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* LEFT COLUMN */}
                <div className="space-y-4">
                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-1.5 h-9 rounded-lg border ${formErrors.subject
                        ? 'border-red-500'
                        : 'border-border-light dark:border-border-dark'
                        } bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary text-sm`}
                      placeholder="Enter subject"
                    />
                    {formErrors.subject && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.subject}</p>
                    )}
                  </div>

                  {/* Leave Type */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
                      Leave Type
                    </label>
                    <select
                      name="leaveType"
                      value={formData.leaveType}
                      onChange={handleInputChange}
                      className="w-full px-3 py-1.5 h-9 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    >
                      <option value="Personal">Personal Leave (PL)</option>
                      <option value="Casual">Casual Leave (CL)</option>
                      <option value="Sick">Sick Leave (SL)</option>
                      <option value="Extra">Extra</option>
                    </select>
                  </div>

                  {/* Date Selection - Multiple Dates */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
                      Select Dates
                    </label>
                    <div className="border border-border-light dark:border-border-dark rounded-lg p-3 bg-white dark:bg-background-dark max-w-full overflow-x-auto">
                      <style>{`
                        .rdp {
                          --rdp-cell-size: 30px;
                          --rdp-accent-color: #f04129;
                          --rdp-background-color: #f04129;
                          margin: 0;
                          color: #1e293b;
                          background-color: white;
                        }
                        @media (max-width: 640px) {
                          .rdp {
                            --rdp-cell-size: 30px;
                          }
                        }
                      .dark .rdp {
                        --rdp-accent-color: #f04129;
                        --rdp-background-color: #f04129;
                        color: #f1f5f9;
                        background-color: #1e293b;
                      }
                      .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                        background-color: rgba(240, 65, 41, 0.1);
                      }
                      .dark .rdp-caption {
                        color: #f1f5f9;
                      }
                      .dark .rdp-head_cell {
                        color: #94a3b8;
                      }
                      .dark .rdp-day {
                        color: #f1f5f9;
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
                        color: #f1f5f9;
                      }
                      .dark .rdp-nav_button:hover {
                        background-color: rgba(240, 65, 41, 0.2);
                      }
                        .rdp-caption_label {
                          color: #1e293b;
                          font-weight: 600;
                          font-size: 0.875rem;
                        }
                        .dark .rdp-caption_label {
                          color: #f1f5f9;
                        }
                        .rdp-head_cell {
                          color: #64748b;
                          font-weight: 500;
                          font-size: 0.75rem;
                        }
                        .dark .rdp-head_cell {
                          color: #94a3b8;
                        }
                        .rdp-day {
                          font-size: 0.75rem;
                        }
                      `}</style>
                      <div className="text-left">
                        <DayPicker
                          mode="multiple"
                          selected={selectedDates}
                          onSelect={(dates) => setSelectedDates(dates || [])}
                          disabled={[{ before: new Date(nowIST()) }, ...disabledDates]}
                          modifiers={{ used: disabledDates }}
                          modifiersClassNames={{ used: 'rdp-day_used' }}
                          title="Disabled dates include past dates and already applied leaves"
                          numberOfMonths={1}
                          pagedNavigation
                          showOutsideDays
                        />
                      </div>
                    </div>
                    {formErrors.dates && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.dates}</p>
                    )}
                    {selectedDates.length === 0 && !formErrors.dates && (
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                        Select at least one date
                      </p>
                    )}
                    {selectedDates.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedDates.sort((a, b) => a.getTime() - b.getTime()).map((date, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#f04129]/10 text-[#f04129] text-xs rounded-full"
                          >
                            {formatIST(date.getTime(), { month: 'short', day: 'numeric' })}
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

                {/* RIGHT COLUMN */}
                <div className="space-y-4">
                  {/* Reason */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
                      Reason
                    </label>
                    <textarea
                      name="reason"
                      value={formData.reason}
                      onChange={handleInputChange}
                      rows={6}
                      className={`w-full px-3 py-1.5 rounded-lg border ${formErrors.reason
                        ? 'border-red-500'
                        : 'border-border-light dark:border-border-dark'
                        } bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm`}
                      placeholder="Enter reason for leave"
                    />
                    {formErrors.reason && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.reason}</p>
                    )}
                  </div>

                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
                      Attach Document (Optional)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.png,.jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                      }}
                      className="w-full px-3 py-1.5 h-9 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#f04129] file:text-white hover:file:bg-[#d63a25] file:cursor-pointer text-sm"
                    />
                    {selectedFile && (
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                        Selected: {selectedFile.name}
                      </p>
                    )}
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                      PDF, JPG, PNG (Max 10MB)
                    </p>
                  </div>

                  {/* Send To (Required - Multi-Select) */}
                  {staffUsers.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
                        Send To <span className="text-red-500">*</span>
                      </label>

                      {/* Selected Recipients Tags */}
                      {formData.sendTo && formData.sendTo.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {formData.sendTo.map((userId) => {
                            const staff = staffUsers.find(s => s._id === userId);
                            if (!staff) return null;
                            return (
                              <span
                                key={userId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs font-medium"
                              >
                                {staff.profile.firstName} {staff.profile.lastName}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRecipient(userId)}
                                  className="ml-1 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Multi-Select Dropdown */}
                      <div className="relative send-to-dropdown-container">
                        <button
                          type="button"
                          onClick={() => setIsSendToDropdownOpen(!isSendToDropdownOpen)}
                          className={`w-full px-3 py-1.5 h-9 rounded-lg border ${formErrors.sendTo
                            ? 'border-red-500'
                            : 'border-border-light dark:border-border-dark'
                            } bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary flex items-center justify-between text-sm`}
                        >
                          <span className={formData.sendTo && formData.sendTo.length > 0 ? 'text-text-primary-light dark:text-text-primary-dark' : 'text-text-secondary-light dark:text-text-secondary-dark'}>
                            {formData.sendTo && formData.sendTo.length > 0
                              ? `${formData.sendTo.length} recipient${formData.sendTo.length > 1 ? 's' : ''} selected`
                              : 'Select recipients...'}
                          </span>
                          <span className="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark text-lg">
                            {isSendToDropdownOpen ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>

                        {/* Dropdown Menu */}
                        {isSendToDropdownOpen && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {staffUsers.map((staff) => {
                              const isSelected = formData.sendTo?.includes(staff._id);
                              return (
                                <label
                                  key={staff._id}
                                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-surface-dark cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleSendToToggle(staff._id)}
                                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                  />
                                  <div className="flex-1">
                                    <p className="text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
                                      {staff.profile.firstName} {staff.profile.lastName}
                                    </p>
                                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                                      {getRoleDisplayName(staff.role)}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {formErrors.sendTo && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.sendTo}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Error */}
              {formErrors.submit && (
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm mt-4">
                  {formErrors.submit}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-border-light dark:border-border-dark flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 h-9 text-sm font-medium text-text-primary-light dark:text-text-primary-dark bg-transparent hover:bg-gray-100 dark:hover:bg-surface-dark rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 h-9 text-sm font-bold text-white bg-[#f04129] hover:bg-[#d63a25] rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">send</span>
                      Submit Leave Request
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectionModal.isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setRejectionModal({ isOpen: false, leaveId: null, userName: '' })}
        >
          <div
            className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-border-light dark:border-border-dark">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
                  Reject Leave Request
                </h2>
                <button
                  onClick={() => setRejectionModal({ isOpen: false, leaveId: null, userName: '' })}
                  className="text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4">
                Rejecting leave request for <strong>{rejectionModal.userName}</strong>. Please provide a reason:
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Enter rejection reason..."
                autoFocus
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border-light dark:border-border-dark">
              <button
                type="button"
                onClick={() => setRejectionModal({ isOpen: false, leaveId: null, userName: '' })}
                className="px-6 py-2 text-sm font-medium text-text-primary-light dark:text-text-primary-dark bg-transparent hover:bg-gray-100 dark:hover:bg-surface-dark rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={isProcessingRejection || !rejectionReason.trim()}
                className="px-6 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessingRejection ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                    </svg>
                    Rejecting...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">close</span>
                    Reject Leave
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Details Modal */}
      {isDetailsModalOpen && selectedLeave && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={handleCloseDetails}
        >
          <div
            className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl w-full max-w-2xl max-w-[95vw] mx-4 max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-border-light dark:border-border-dark flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {/* User Avatar */}
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {typeof selectedLeave.userId === 'object' && selectedLeave.userId.profile
                      ? `${selectedLeave.userId.profile.firstName.charAt(0)}${selectedLeave.userId.profile.lastName.charAt(0)}`
                      : 'U'}
                  </div>
                  {/* User Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                      {getUserName(selectedLeave)}
                    </p>
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate">
                      {typeof selectedLeave.userId === 'object' ? selectedLeave.userId.email : 'N/A'}
                    </p>
                  </div>
                  {/* Status Badge */}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getStatusColor(selectedLeave.status)}`}>
                    {selectedLeave.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {(selectedLeave.status === 'Approved' || selectedLeave.status === 'Pending') && (
                    <button
                      onClick={() => generateLeavePDF(selectedLeave)}
                      className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                      title="Download PDF"
                    >
                      <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                    </button>
                  )}
                  <button
                    onClick={handleCloseDetails}
                    className="text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Leave Details - 3 Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
                    Leave Type
                  </h3>
                  <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
                    {selectedLeave.leaveType}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
                    Duration
                  </h3>
                  <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
                    {selectedLeave.daysCount} {selectedLeave.daysCount === 1 ? 'day' : 'days'}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
                    Date Range
                  </h3>
                  <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
                    {formatDateRange(selectedLeave.startDate, selectedLeave.endDate, selectedLeave.dates)}
                  </p>
                  {selectedLeave.dates && selectedLeave.dates.length > 0 && (
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                      {formatDatesList(selectedLeave.dates)}
                    </p>
                  )}
                </div>
              </div>

              {/* Leave Balance Context (Admins Only) */}
              {isAdminOrStaff && selectedLeave.balance && (
                <div className="pt-4 border-t border-border-light dark:border-border-dark">
                  <h3 className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2">
                    Leave Balance Context
                  </h3>
                  <div className="bg-gray-50 dark:bg-background-dark rounded-lg p-3 text-xs">
                    <div className="grid grid-cols-4 gap-2 font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1 border-b border-border-light dark:border-border-dark pb-1">
                      <div>Type</div>
                      <div>Remaining</div>
                      <div>Used</div>
                      <div>Total</div>
                    </div>
                    {/* Personal */}
                    <div className={`grid grid-cols-4 gap-2 py-1 ${selectedLeave.leaveType === 'Personal' ? 'bg-blue-50 dark:bg-blue-900/20 -mx-1 px-1 rounded' : ''}`}>
                      <div className="font-medium text-text-primary-light dark:text-text-primary-dark">Personal</div>
                      <div className={selectedLeave.balance.remaining.Personal < 0 ? 'text-red-500 font-bold' : ''}>
                        {selectedLeave.balance.remaining.Personal}
                      </div>
                      <div>{selectedLeave.balance.used.Personal}</div>
                      <div>{selectedLeave.balance.quota.pl}</div>
                    </div>
                    {/* Casual */}
                    <div className={`grid grid-cols-4 gap-2 py-1 ${selectedLeave.leaveType === 'Casual' ? 'bg-blue-50 dark:bg-blue-900/20 -mx-1 px-1 rounded' : ''}`}>
                      <div className="font-medium text-text-primary-light dark:text-text-primary-dark">Casual</div>
                      <div className={selectedLeave.balance.remaining.Casual < 0 ? 'text-red-500 font-bold' : ''}>
                        {selectedLeave.balance.remaining.Casual}
                      </div>
                      <div>{selectedLeave.balance.used.Casual}</div>
                      <div>{selectedLeave.balance.quota.cl}</div>
                    </div>
                    {/* Sick */}
                    <div className={`grid grid-cols-4 gap-2 py-1 ${selectedLeave.leaveType === 'Sick' ? 'bg-blue-50 dark:bg-blue-900/20 -mx-1 px-1 rounded' : ''}`}>
                      <div className="font-medium text-text-primary-light dark:text-text-primary-dark">Sick</div>
                      <div className={selectedLeave.balance.remaining.Sick < 0 ? 'text-red-500 font-bold' : ''}>
                        {selectedLeave.balance.remaining.Sick}
                      </div>
                      <div>{selectedLeave.balance.used.Sick}</div>
                      <div>{selectedLeave.balance.quota.sl}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div className="pt-2 border-t border-border-light dark:border-border-dark">
                <h3 className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
                  Reason
                </h3>
                <p className="text-sm text-text-primary-light dark:text-text-primary-dark whitespace-pre-wrap">
                  {selectedLeave.reason || 'No reason provided'}
                </p>
              </div>

              {/* Approval Information */}
              <div>
                <h3 className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
                  Approval Information
                </h3>
                {selectedLeave.status === 'Approved' && selectedLeave.approvedBy ? (
                  <div className="space-y-1">
                    <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
                      <span className="font-medium">Approved By:</span>{' '}
                      {typeof selectedLeave.approvedBy === 'object'
                        ? `${selectedLeave.approvedBy.profile.firstName} ${selectedLeave.approvedBy.profile.lastName}`
                        : 'N/A'}
                    </p>
                    {selectedLeave.updatedAt && (
                      <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
                        <span className="font-medium">Approved On:</span>{' '}
                        {formatIST(new Date(selectedLeave.updatedAt).getTime(), {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                ) : selectedLeave.status === 'Rejected' && selectedLeave.approvedBy ? (
                  <div className="space-y-1">
                    <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
                      <span className="font-medium">Rejected By:</span>{' '}
                      {typeof selectedLeave.approvedBy === 'object'
                        ? `${selectedLeave.approvedBy.profile.firstName} ${selectedLeave.approvedBy.profile.lastName}`
                        : 'N/A'}
                    </p>
                    {selectedLeave.updatedAt && (
                      <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
                        <span className="font-medium">Rejected On:</span>{' '}
                        {formatIST(new Date(selectedLeave.updatedAt).getTime(), {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                    {selectedLeave.rejectionReason && (
                      <div>
                        <p className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-0.5">
                          Reason:
                        </p>
                        <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
                          {selectedLeave.rejectionReason}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
                    Pending Approval
                  </p>
                )}
              </div>

              {/* Attachment */}
              {/* Attachment */}
              {selectedLeave.attachment && (
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2">
                    Attached Document
                  </h3>
                  {(() => {
                    const url = `${import.meta.env.VITE_API_URL || ''}${selectedLeave.attachment}`;
                    // Simple extension check
                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(selectedLeave.attachment);
                    const isPDF = /\.pdf$/i.test(selectedLeave.attachment);

                    if (isImage) {
                      return (
                        <div className="flex flex-col gap-2">
                          <img
                            src={url}
                            alt="Attachment"
                            className="max-w-full h-auto max-h-64 object-contain rounded-lg border border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-900"
                          />
                          <a href={url} download target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline self-start flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">download</span>
                            Download Image
                          </a>
                        </div>
                      );
                    }

                    return (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 h-9 rounded-lg border-2 border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
                      >
                        <span className="material-symbols-outlined text-red-600 text-lg">
                          {isPDF ? 'picture_as_pdf' : 'attach_file'}
                        </span>
                        {isPDF ? 'Open PDF Document' : 'View Document'}
                      </a>
                    );
                  })()}
                </div>
              )}

              {/* Application Date */}
              <div>
                <h3 className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
                  Application Date
                </h3>
                <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
                  {formatIST(new Date(selectedLeave.createdAt).getTime(), {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border-light dark:border-border-dark flex-shrink-0">
              {/* Show Approve/Reject buttons for Admins/Staff when viewing pending leaves that are not their own */}
              {isAdminOrStaff &&
                selectedLeave.status === 'Pending' &&
                typeof selectedLeave.userId === 'object' &&
                selectedLeave.userId._id !== user?.id ? (
                <div className="flex justify-end gap-3">
                  <button
                    onClick={async () => {
                      try {
                        await api.put(`/api/leaves/${selectedLeave._id}/status`, {
                          status: 'Approved',
                        });
                        setToast({
                          message: `Leave approved for ${getUserName(selectedLeave)}`,
                          type: 'success'
                        });
                        handleCloseDetails();

                        // Refresh data
                        await fetchLeaveData(false);
                      } catch (err: any) {
                        console.error('Failed to approve leave:', err);
                        const errorMsg = err.response?.data?.msg || 'Failed to approve leave';
                        setToast({ message: errorMsg, type: 'error' });
                      }
                    }}
                    className="px-4 py-2 h-10 text-sm font-bold text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">check</span>
                    Approve Leave
                  </button>
                  <button
                    onClick={() => {
                      handleCloseDetails();
                      handleRejectClick(selectedLeave._id);
                    }}
                    className="px-4 py-2 h-10 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                    Reject Leave
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCloseDetails}
                  className="w-full px-4 py-2 h-10 text-sm font-medium text-text-primary-light dark:text-text-primary-dark bg-transparent hover:bg-gray-100 dark:hover:bg-surface-dark rounded-lg transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )
      }

      {/* Toast Notification */}
      {
        toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )
      }
    </div >
  );
};

export default Leaves;

