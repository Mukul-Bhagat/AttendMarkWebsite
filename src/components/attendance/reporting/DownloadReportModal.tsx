import React, { useState } from 'react';
import { X, Calendar, Building, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadAttendanceReport, DownloadReportOptions } from '../../../api/reportingApi';

interface DownloadReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    startDate: string;
    endDate: string;
    userId?: string;
    initialOrgName?: string;
    initialOrgLogo?: string;
}

const DownloadReportModal: React.FC<DownloadReportModalProps> = ({
    isOpen,
    onClose,
    startDate: initialStartDate,
    endDate: initialEndDate,
    userId,
    initialOrgName = '',
    initialOrgLogo = '',
}) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadForm, setDownloadForm] = useState({
        startDate: initialStartDate,
        startTime: '00:00',
        endDate: initialEndDate,
        endTime: '23:59',
        organizationName: initialOrgName,
        organizationLogo: initialOrgLogo,
        reportType: 'ALL' as 'ALL' | 'PRESENT' | 'ABSENT',
    });

    if (!isOpen) return null;

    const handleDownloadLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Logo should be less than 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setDownloadForm({ ...downloadForm, organizationLogo: reader.result as string });
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (format: 'pdf' | 'excel' = 'pdf') => {
        if (!downloadForm.startDate || !downloadForm.endDate) {
            toast.error('Please select both start and end dates');
            return;
        }

        setIsDownloading(true);
        const toastId = toast.loading(`Generating your ${format.toUpperCase()}...`);

        try {
            // Prepare ISO strings with time
            const startDateTime = `${downloadForm.startDate}T${downloadForm.startTime}:00`;
            const endDateTime = `${downloadForm.endDate}T${downloadForm.endTime}:59`;

            const options: DownloadReportOptions = {
                organizationName: downloadForm.organizationName,
                organizationLogo: downloadForm.organizationLogo,
                startDate: startDateTime,
                endDate: endDateTime,
                reportType: downloadForm.reportType,
                format,
                userId,
            };

            const response = await downloadAttendanceReport(options);

            // Create download link
            const contentType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const extension = format === 'pdf' ? 'pdf' : 'xlsx';

            const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: contentType });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Attendance_Report_${downloadForm.startDate}.${extension}`);
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                link.parentNode?.removeChild(link);
            }, 100);

            toast.success(`${format.toUpperCase()} Downloaded!`, { id: toastId });
            onClose();
        } catch (err: any) {
            toast.error(`Failed to generate ${format.toUpperCase()}`, { id: toastId });
            console.error(err);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-[#0f172a]/60 backdrop-blur-md overflow-y-auto">
            <div className="bg-surface-light dark:bg-surface-dark w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-border-light dark:border-border-dark my-8 animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="p-8 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-background-light dark:bg-background-dark/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                            <span className="material-symbols-outlined text-3xl">picture_as_pdf</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark tracking-tight">Generate Report</h2>
                            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium">Download branded attendance timesheet</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-text-secondary-light hover:text-red-500 dark:hover:text-red-400 transition-all transform hover:rotate-90"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {/* 1. Date & Time Selection */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-xs">
                            <Calendar size={16} />
                            <span>Report Range (Date & Time)</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest ml-1">From Date</label>
                                <input
                                    type="date"
                                    required
                                    value={downloadForm.startDate}
                                    onChange={(e) => setDownloadForm({ ...downloadForm, startDate: e.target.value })}
                                    className="w-full px-5 py-3.5 rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark/50 text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest ml-1">From Time</label>
                                <input
                                    type="time"
                                    required
                                    value={downloadForm.startTime}
                                    onChange={(e) => setDownloadForm({ ...downloadForm, startTime: e.target.value })}
                                    className="w-full px-5 py-3.5 rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark/50 text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest ml-1">To Date</label>
                                <input
                                    type="date"
                                    required
                                    min={downloadForm.startDate}
                                    value={downloadForm.endDate}
                                    onChange={(e) => setDownloadForm({ ...downloadForm, endDate: e.target.value })}
                                    className="w-full px-5 py-3.5 rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark/50 text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest ml-1">To Time</label>
                                <input
                                    type="time"
                                    required
                                    value={downloadForm.endTime}
                                    onChange={(e) => setDownloadForm({ ...downloadForm, endTime: e.target.value })}
                                    className="w-full px-5 py-3.5 rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark/50 text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                />
                            </div>
                        </div>
                    </section>

                    {/* 2. Report Type Selection */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-indigo-500 font-black uppercase tracking-widest text-xs">
                            <span className="material-symbols-outlined text-base">analytics</span>
                            <span>Report Filter</span>
                        </div>
                        <div className="flex gap-2">
                            {(['ALL', 'PRESENT', 'ABSENT'] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setDownloadForm({ ...downloadForm, reportType: type })}
                                    className={`flex-1 py-3 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${downloadForm.reportType === type ? 'bg-[#181511] border-[#181511] text-white shadow-lg' : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-background-light dark:hover:bg-background-dark'}`}
                                >
                                    {type} Report
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* 3. Branding */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 text-emerald-500 font-black uppercase tracking-widest text-xs">
                            <Building size={16} />
                            <span>Organization / Institute (Optional)</span>
                        </div>
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="College / Institute Name"
                                value={downloadForm.organizationName}
                                onChange={(e) => setDownloadForm({ ...downloadForm, organizationName: e.target.value })}
                                className="w-full px-6 py-4 rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark/50 text-text-primary-light dark:text-text-primary-dark focus:ring-4 focus:ring-primary/10 transition-all font-bold"
                            />

                            <div className="flex items-center gap-4 p-4 bg-background-light dark:bg-background-dark/30 border border-border-light dark:border-border-dark rounded-2xl">
                                <div className="w-12 h-12 rounded-xl border border-dashed border-border-light dark:border-border-dark flex items-center justify-center bg-surface-light dark:bg-background-dark shadow-sm">
                                    {downloadForm.organizationLogo ? <img src={downloadForm.organizationLogo} className="w-full h-full object-contain p-1" /> : <Upload size={16} className="text-text-secondary-light" />}
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-text-secondary-light uppercase tracking-widest">Institute Logo</p>
                                    <input type="file" id="down-logo-modal" className="hidden" accept="image/*" onChange={handleDownloadLogoUpload} />
                                    <label htmlFor="down-logo-modal" className="text-xs font-bold text-primary hover:underline cursor-pointer">
                                        {downloadForm.organizationLogo ? 'Change Logo' : 'Upload Image'}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => handleSubmit('pdf')}
                            disabled={isDownloading}
                            className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-[#181511] dark:bg-primary text-white font-black text-sm uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isDownloading ? (
                                <div className="h-5 w-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
                                    <span>PDF Report</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSubmit('excel')}
                            disabled={isDownloading}
                            className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isDownloading ? (
                                <div className="h-5 w-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-xl">table_chart</span>
                                    <span>Excel Report</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DownloadReportModal;
