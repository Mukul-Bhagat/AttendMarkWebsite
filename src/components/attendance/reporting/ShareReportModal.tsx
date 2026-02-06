import React, { useState, useEffect } from 'react';
import { Share2, X, Send, User, Calendar, Building, Upload, Plus, Clock, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { shareAttendanceReport, ShareReportOptions } from '../../../api/reportingApi';

interface ShareReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    startDate: string;
    endDate: string;
    userId?: string;
    initialOrgName?: string;
    initialOrgLogo?: string;
}

const ShareReportModal: React.FC<ShareReportModalProps> = ({
    isOpen,
    onClose,
    startDate: initialStartDate,
    endDate: initialEndDate,
    userId,
    initialOrgName = '',
    initialOrgLogo = '',
}) => {
    const [isSharing, setIsSharing] = useState(false);
    const [shareForm, setShareForm] = useState({
        // Recipient 1
        recipientName: '',
        recipientEmail: '',
        recipientGender: 'Male' as 'Male' | 'Female' | 'Other',
        recipientRole: 'HOD' as 'TPO' | 'HOD' | 'HR' | 'OTHER',

        // Recipient 2 (Optional)
        hasSecondRecipient: false,
        recipient2Name: '',
        recipient2Email: '',
        recipient2Gender: 'Male' as 'Male' | 'Female' | 'Other',
        recipient2Role: 'HR' as 'TPO' | 'HOD' | 'HR' | 'OTHER',

        // Institute Branding
        organizationName: initialOrgName,
        organizationLogo: initialOrgLogo,

        // Date Range (Current Share)
        startDate: initialStartDate,
        endDate: initialEndDate,

        // Automation Toggle
        automateWeekly: false,
        preferredWeekday: 'Saturday',
        preferredTime: '18:00',

        // Monthly Automation
        automateMonthly: false,
        monthlySchedule: 'end_of_month',
        monthlyTime: '10:00',
    });

    // Sync form with props when modal opens
    // MUST be called before any early returns to avoid Hooks violation
    useEffect(() => {
        if (isOpen) {
            setShareForm(prev => ({
                ...prev,
                startDate: initialStartDate,
                endDate: initialEndDate
            }));
        }
    }, [isOpen, initialStartDate, initialEndDate]);

    if (!isOpen) return null;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Logo should be less than 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setShareForm({ ...shareForm, organizationLogo: reader.result as string });
        };
        reader.readAsDataURL(file);
    };

    const handleShareSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!shareForm.recipientName || !shareForm.recipientEmail || !shareForm.startDate || !shareForm.endDate) {
            toast.error('Please fill in all required fields');
            return;
        }

        if (!emailRegex.test(shareForm.recipientEmail)) {
            toast.error('Please enter a valid email address');
            return;
        }

        // If second recipient is enabled, validate their fields
        if (shareForm.hasSecondRecipient) {
            if (!shareForm.recipient2Name || !shareForm.recipient2Email) {
                toast.error('Please fill in Second Recipient details');
                return;
            }
            if (!emailRegex.test(shareForm.recipient2Email)) {
                toast.error('Invalid Email for Second Recipient');
                return;
            }
        }

        setIsSharing(true);
        const toastId = toast.loading('Processing request...');

        try {
            const options: ShareReportOptions = {
                ...shareForm,
                userId,
            };

            console.log('[ShareReportModal] Submitting share request:', {
                recipientEmail: options.recipientEmail,
                startDate: options.startDate,
                endDate: options.endDate,
                hasSecondRecipient: options.hasSecondRecipient,
                automateWeekly: options.automateWeekly,
                automateMonthly: options.automateMonthly
            });

            const response = await shareAttendanceReport(options);

            console.log('[ShareReportModal] Full response object:', response);
            console.log('[ShareReportModal] Response.data:', response.data);
            console.log('[ShareReportModal] Response.data.data:', response.data?.data);
            console.log('[ShareReportModal] needsApproval?:', response.data?.data?.needsApproval);

            // Check if this was an approval request or direct send
            if (response.data?.data?.needsApproval) {
                console.log('[ShareReportModal] Request requires admin approval');
                console.log('[ShareReportModal] Request ID:', response.data.data.requestId);
                console.log('[ShareReportModal] Calling toast.success...');

                const message = response.data?.message || '✅ Your report share request has been sent to the admin for approval!';
                console.log('[ShareReportModal] Toast message:', message);

                toast.success(message, { id: toastId, duration: 5000 });
                console.log('[ShareReportModal] Toast.success called successfully');
            } else {
                console.log('[ShareReportModal] Report sent directly (admin user)');
                toast.success(
                    response.data?.message || '✅ Report shared successfully!',
                    { id: toastId, duration: 4000 }
                );
            }

            console.log('[ShareReportModal] Closing modal...');
            onClose();
        } catch (err: any) {
            console.error('[ShareReportModal] Share request failed:', err);
            console.error('[ShareReportModal] Error response:', err.response?.data);
            toast.error(err.response?.data?.message || 'Failed to share attendance report', { id: toastId });
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-[#0f172a]/60 backdrop-blur-md overflow-y-auto">
            <div className="bg-surface-light dark:bg-surface-dark w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-border-light dark:border-border-dark my-8 animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="p-8 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-background-light dark:bg-background-dark/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                            <Share2 size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark tracking-tight">Share & Automate Report</h2>
                            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium">Configure recipients and weekly automation</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-text-secondary-light hover:text-red-500 dark:hover:text-red-400 transition-all transform hover:rotate-90"
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleShareSubmit} className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="p-8 space-y-10">
                        {/* 1. First Recipient */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-2 text-primary">
                                <User size={20} className="font-bold" />
                                <h3 className="text-lg font-extrabold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider">Primary Recipient</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-text-secondary-light uppercase tracking-widest ml-1">Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Dr. Rajesh Kumar"
                                        value={shareForm.recipientName}
                                        onChange={(e) => setShareForm({ ...shareForm, recipientName: e.target.value })}
                                        className="w-full px-5 py-3.5 rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark/50 text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-text-secondary-light uppercase tracking-widest ml-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="recipient@college.edu"
                                        value={shareForm.recipientEmail}
                                        onChange={(e) => setShareForm({ ...shareForm, recipientEmail: e.target.value })}
                                        className="w-full px-5 py-3.5 rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark/50 text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-text-secondary-light uppercase tracking-widest ml-1">Role</label>
                                    <select
                                        value={shareForm.recipientRole}
                                        onChange={(e) => setShareForm({ ...shareForm, recipientRole: e.target.value as any })}
                                        className="w-full px-5 py-3.5 rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark/50 text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-primary/10 transition-all font-bold appearance-none"
                                    >
                                        <option value="HOD">HOD</option>
                                        <option value="TPO">TPO</option>
                                        <option value="HR">HR Manager</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-text-secondary-light uppercase tracking-widest ml-1">Gender</label>
                                    <select
                                        value={shareForm.recipientGender}
                                        onChange={(e) => setShareForm({ ...shareForm, recipientGender: e.target.value as any })}
                                        className="w-full px-5 py-3.5 rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark/50 text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-primary/10 transition-all font-bold appearance-none"
                                    >
                                        <option value="Male">Male (Sir)</option>
                                        <option value="Female">Female (Madam)</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </section>

                        {/* 2. Second Recipient Toggle */}
                        <section className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-primary">
                                    <Plus size={20} className="font-bold" />
                                    <h3 className="text-lg font-extrabold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider">Second Recipient</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShareForm({ ...shareForm, hasSecondRecipient: !shareForm.hasSecondRecipient })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${shareForm.hasSecondRecipient ? 'bg-primary' : 'bg-background-light dark:bg-background-dark'}`}
                                >
                                    <span className={`${shareForm.hasSecondRecipient ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                                </button>
                            </div>

                            {shareForm.hasSecondRecipient && (
                                <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-800/30 animate-in slide-in-from-top-2 duration-300 space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-indigo-400 uppercase tracking-widest ml-1">Name</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Principal's Name"
                                                value={shareForm.recipient2Name}
                                                onChange={(e) => setShareForm({ ...shareForm, recipient2Name: e.target.value })}
                                                className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-indigo-400 uppercase tracking-widest ml-1">Email</label>
                                            <input
                                                type="email"
                                                placeholder="hr@college.edu"
                                                value={shareForm.recipient2Email}
                                                onChange={(e) => setShareForm({ ...shareForm, recipient2Email: e.target.value })}
                                                className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-indigo-400 uppercase tracking-widest ml-1">Role</label>
                                            <select
                                                value={shareForm.recipient2Role}
                                                onChange={(e) => setShareForm({ ...shareForm, recipient2Role: e.target.value as any })}
                                                className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold appearance-none"
                                            >
                                                <option value="HOD">HOD</option>
                                                <option value="TPO">TPO</option>
                                                <option value="HR">HR Manager</option>
                                                <option value="OTHER">Other</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-indigo-400 uppercase tracking-widest ml-1">Gender</label>
                                            <select
                                                value={shareForm.recipient2Gender}
                                                onChange={(e) => setShareForm({ ...shareForm, recipient2Gender: e.target.value as any })}
                                                className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold appearance-none"
                                            >
                                                <option value="Male">Male (Sir)</option>
                                                <option value="Female">Female (Madam)</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* 3. Institute Branding */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-2 text-emerald-500">
                                <Building size={20} className="font-bold" />
                                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Organization / Institute (Logo & Name)</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">College / Institute Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Indian Institute of Technology"
                                        value={shareForm.organizationName}
                                        onChange={(e) => setShareForm({ ...shareForm, organizationName: e.target.value })}
                                        className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium"
                                    />
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-3xl">
                                    <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-white dark:bg-slate-800 overflow-hidden">
                                        {shareForm.organizationLogo ? (
                                            <img src={shareForm.organizationLogo} alt="Preview" className="w-full h-full object-contain p-2" />
                                        ) : (
                                            <Upload className="text-slate-400" size={24} />
                                        )}
                                    </div>
                                    <div className="flex-1 text-center sm:text-left">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Upload Institute Logo</p>
                                        <p className="text-xs text-slate-500 mb-3">Visible on the top of student's PDF report</p>
                                        <input
                                            type="file"
                                            id="modal-logo-share-modal"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                        />
                                        <label
                                            htmlFor="modal-logo-share-modal"
                                            className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white hover:bg-slate-50 transition-all shadow-sm"
                                        >
                                            <Upload size={14} />
                                            {shareForm.organizationLogo ? 'Change Logo' : 'Select Image'}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 4. Date Range (Immediate Send) */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-2 text-orange-500">
                                <Calendar size={20} className="font-bold" />
                                <h3 className="text-lg font-extrabold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider">Current Report Period</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-text-secondary-light uppercase tracking-widest ml-1">From Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={shareForm.startDate}
                                        onChange={(e) => setShareForm({ ...shareForm, startDate: e.target.value })}
                                        className="w-full px-5 py-3.5 rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark/50 text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-orange-500/10 transition-all font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-text-secondary-light uppercase tracking-widest ml-1">To Date</label>
                                    <input
                                        type="date"
                                        required
                                        min={shareForm.startDate}
                                        value={shareForm.endDate}
                                        onChange={(e) => setShareForm({ ...shareForm, endDate: e.target.value })}
                                        className="w-full px-5 py-3.5 rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark/50 text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-orange-500/10 transition-all font-medium"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* 5. Weekly Automation Settings */}
                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                            <div className={`p-5 rounded-2xl transition-all duration-300 ${shareForm.automateWeekly ? 'bg-primary/5 border-2 border-primary/20' : 'bg-slate-50/50 border border-slate-200 dark:border-slate-800 dark:bg-slate-800/20'}`}>
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl transition-all ${shareForm.automateWeekly ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'}`}>
                                            <Sparkles size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-slate-900 dark:text-white">Enable Weekly Automation</h4>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Highly Recommended</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShareForm({ ...shareForm, automateWeekly: !shareForm.automateWeekly })}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none ${shareForm.automateWeekly ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                                    >
                                        <span className={`${shareForm.automateWeekly ? 'translate-x-6' : 'translate-x-1'} inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md`} />
                                    </button>
                                </div>

                                {shareForm.automateWeekly && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in zoom-in-95 duration-300">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-primary uppercase tracking-wider ml-2">Repeat Day</label>
                                            <select
                                                value={shareForm.preferredWeekday}
                                                onChange={(e) => setShareForm({ ...shareForm, preferredWeekday: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-white dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-primary/10 transition-all font-bold text-sm appearance-none"
                                            >
                                                <option value="Monday">Every Monday</option>
                                                <option value="Tuesday">Every Tuesday</option>
                                                <option value="Wednesday">Every Wednesday</option>
                                                <option value="Thursday">Every Thursday</option>
                                                <option value="Friday">Every Friday</option>
                                                <option value="Saturday">Every Saturday</option>
                                                <option value="Sunday">Every Sunday</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-primary uppercase tracking-wider ml-2">Execution Time</label>
                                            <div className="relative">
                                                <Clock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                                <input
                                                    type="time"
                                                    value={shareForm.preferredTime}
                                                    onChange={(e) => setShareForm({ ...shareForm, preferredTime: e.target.value })}
                                                    className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-white dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-primary/10 transition-all font-bold text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 6. Monthly Automation Settings */}
                        <div className="pt-4">
                            <div className={`p-5 rounded-2xl transition-all duration-300 ${shareForm.automateMonthly ? 'bg-indigo-500/5 border-2 border-indigo-500/20' : 'bg-slate-50/50 border border-slate-200 dark:border-slate-800 dark:bg-slate-800/20'}`}>
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl transition-all ${shareForm.automateMonthly ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                            <Calendar size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-slate-900 dark:text-white">Enable Monthly Automation</h4>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">For Monthly Reports</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShareForm({ ...shareForm, automateMonthly: !shareForm.automateMonthly })}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none ${shareForm.automateMonthly ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                    >
                                        <span className={`${shareForm.automateMonthly ? 'translate-x-6' : 'translate-x-1'} inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md`} />
                                    </button>
                                </div>

                                {shareForm.automateMonthly && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in zoom-in-95 duration-300">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-wider ml-2">Send On</label>
                                            <select
                                                value={shareForm.monthlySchedule || 'end_of_month'}
                                                onChange={(e) => setShareForm({ ...shareForm, monthlySchedule: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-white dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500/10 transition-all font-bold text-sm appearance-none"
                                            >
                                                <option value="start_of_month">Start of Month (1st)</option>
                                                <option value="end_of_month">End of Month (Last Day)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-wider ml-2">Execution Time</label>
                                            <div className="relative">
                                                <Clock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                                <input
                                                    type="time"
                                                    value={shareForm.monthlyTime || '10:00'}
                                                    onChange={(e) => setShareForm({ ...shareForm, monthlyTime: e.target.value })}
                                                    className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-white dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500/10 transition-all font-bold text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="p-8 bg-background-light dark:bg-background-dark/50 border-t border-border-light dark:border-border-dark flex flex-col sm:flex-row gap-4 items-center">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-10 py-4 rounded-2xl border-2 border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark font-extrabold text-sm uppercase tracking-wider hover:bg-surface-light dark:hover:bg-surface-dark transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSharing}
                            className="w-full sm:flex-1 flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-[#181511] dark:bg-primary text-white font-black text-base uppercase tracking-widest shadow-2xl shadow-slate-900/20 dark:shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isSharing ? (
                                <>
                                    <div className="h-6 w-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <Send size={20} />
                                    <span>{shareForm.automateWeekly ? 'Send & Automate' : 'Share Report Now'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShareReportModal;
