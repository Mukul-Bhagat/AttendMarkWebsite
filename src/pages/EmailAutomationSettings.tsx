import React, { useState, useEffect } from 'react';
import { Mail, Save, Edit2, Power, Trash2, Upload, X, PlusCircle, User, Briefcase, Calendar, Clock } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

import { appLogger } from '../shared/logger';
interface EmailConfig {
    _id?: string;
    recipientName: string;
    recipientEmail: string;
    recipientGender: 'Male' | 'Female' | 'Other';
    recipientRole: 'TPO' | 'HOD' | 'HR' | 'OTHER';
    internName: string;
    organizationName: string;
    organizationLogo?: string;
    frequency: 'weekly' | 'monthly';
    scheduleTiming: 'start_of_week' | 'end_of_week' | 'start_of_month' | 'end_of_month';
    preferredWeekday?: string;
    preferredTime: string;
    isEnabled: boolean;
}

const EmailAutomationSettings: React.FC = () => {
    const [configs, setConfigs] = useState<EmailConfig[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [currentConfigId, setCurrentConfigId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState<EmailConfig>({
        recipientName: '',
        recipientEmail: '',
        recipientGender: 'Male',
        recipientRole: 'TPO',
        internName: '',
        organizationName: '',
        organizationLogo: '',
        frequency: 'weekly',
        scheduleTiming: 'end_of_week',
        preferredWeekday: 'Saturday',
        preferredTime: '10:00',
        isEnabled: true,
    });

    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const genders = ['Male', 'Female', 'Other'];
    const roles = ['TPO', 'HOD', 'HR', 'OTHER'];

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/email-automation/configs');
            setConfigs(response.data.data || []);

            // If no configs exist, show form automatically
            if (!response.data.data || response.data.data.length === 0) {
                setIsEditing(true);
                setCurrentConfigId(null);
            }
        } catch (error: any) {
            appLogger.error('Error fetching configs:', error);
            toast.error('Failed to load configurations');
        } finally {
            setLoading(false);
        }
    };

    const handleAddRecipient = () => {
        setFormData({
            recipientName: '',
            recipientEmail: '',
            recipientGender: 'Male',
            recipientRole: 'TPO',
            internName: configs.length > 0 ? configs[0].internName : '',
            organizationName: configs.length > 0 ? configs[0].organizationName : '',
            organizationLogo: configs.length > 0 ? configs[0].organizationLogo : '',
            frequency: 'weekly',
            scheduleTiming: 'end_of_week',
            preferredWeekday: 'Saturday',
            preferredTime: '10:00',
            isEnabled: true,
        });
        setCurrentConfigId(null);
        setIsEditing(true);
    };

    const handleEditRecipient = (config: EmailConfig) => {
        setFormData({ ...config });
        setCurrentConfigId(config._id || null);
        setIsEditing(true);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Image size should be less than 2MB');
            return;
        }

        if (!file.type.startsWith('image/')) {
            toast.error('Please select a valid image file');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData({ ...formData, organizationLogo: reader.result as string });
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.recipientName || !formData.recipientEmail || !formData.internName || !formData.organizationName) {
            toast.error('Please fill in all required fields');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.recipientEmail)) {
            toast.error('Please enter a valid email address');
            return;
        }

        try {
            setSaving(true);

            if (currentConfigId) {
                // Update existing
                await api.put(`/api/email-automation/config/${currentConfigId}`, formData);
                toast.success('Recipient details updated successfully');
            } else {
                // Create new
                await api.post('/api/email-automation/config', formData);
                toast.success('New recipient added successfully');
            }

            setIsEditing(false);
            fetchConfigs();
        } catch (error: any) {
            appLogger.error('Error saving config:', error);
            toast.error(error.response?.data?.msg || 'Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (config: EmailConfig) => {
        try {
            const response = await api.patch(`/api/email-automation/config/toggle/${config._id}`);
            toast.success(response.data.message);
            fetchConfigs();
        } catch (error: any) {
            toast.error('Failed to toggle automation');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this recipient?')) {
            return;
        }

        try {
            await api.delete(`/api/email-automation/config/${id}`);
            toast.success('Recipient removed successfully');
            fetchConfigs();
        } catch (error: any) {
            toast.error('Failed to delete configuration');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading configurations...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                {/* Header */}
                <div className="bg-slate-900 px-8 py-10 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 font-manrope">
                        <div className="flex items-center gap-4">
                            <div className="bg-primary/20 p-3 rounded-xl border border-primary/30">
                                <Mail className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold tracking-tight">Email Automation</h1>
                                <p className="text-slate-400 mt-1 text-lg">Manage weekly attendance reports</p>
                            </div>
                        </div>
                        {(!isEditing || configs.length > 0) && (
                            <button
                                onClick={handleAddRecipient}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-primary/20"
                            >
                                <PlusCircle className="w-5 h-5" />
                                Add Recipient
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 bg-slate-50/50">
                    {isEditing ? (
                        /* Edit/Add Form */
                        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <User className="w-5 h-5 text-primary" />
                                    {currentConfigId ? 'Edit Recipient Details' : 'Configure New Recipient'}
                                </h2>
                                <button
                                    type="button"
                                    disabled={configs.length === 0}
                                    onClick={() => setIsEditing(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1 uppercase tracking-wider">Recipient Name</label>
                                    <input
                                        type="text"
                                        value={formData.recipientName}
                                        onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none text-slate-900 font-medium"
                                        placeholder="Full Name"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1 uppercase tracking-wider">Recipient Email</label>
                                    <input
                                        type="email"
                                        value={formData.recipientEmail}
                                        onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none text-slate-900 font-medium"
                                        placeholder="email@example.com"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1 uppercase tracking-wider">Gender</label>
                                    <select
                                        value={formData.recipientGender}
                                        onChange={(e) => setFormData({ ...formData, recipientGender: e.target.value as any })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none text-slate-900 font-medium appearance-none"
                                        required
                                    >
                                        {genders.map((gender) => (
                                            <option key={gender} value={gender}>{gender}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ml-1 uppercase tracking-wider">Recipient Role</label>
                                    <select
                                        value={formData.recipientRole}
                                        onChange={(e) => setFormData({ ...formData, recipientRole: e.target.value as any })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none text-slate-900 font-medium appearance-none"
                                        required
                                    >
                                        {roles.map((role) => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
                                    <Clock className="w-5 h-5 text-primary" />
                                    Email Schedule
                                </h2>

                                {/* Frequency Selection - Compact Buttons */}
                                <div className="space-y-4">
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({
                                                ...formData,
                                                frequency: 'weekly',
                                                scheduleTiming: 'end_of_week',
                                                preferredWeekday: 'Saturday'
                                            })}
                                            className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all ${formData.frequency === 'weekly'
                                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            📅 Weekly
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({
                                                ...formData,
                                                frequency: 'monthly',
                                                scheduleTiming: 'end_of_month',
                                                preferredWeekday: undefined
                                            })}
                                            className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all ${formData.frequency === 'monthly'
                                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            📆 Monthly
                                        </button>
                                    </div>

                                    {/* Dynamic Options Based on Frequency */}
                                    {formData.frequency === 'weekly' ? (
                                        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">When to Send?</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, scheduleTiming: 'start_of_week', preferredWeekday: 'Monday' })}
                                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${formData.scheduleTiming === 'start_of_week'
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-white text-slate-600 hover:bg-slate-100'
                                                        }`}
                                                >
                                                    Start of Week
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, scheduleTiming: 'end_of_week', preferredWeekday: 'Saturday' })}
                                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${formData.scheduleTiming === 'end_of_week'
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-white text-slate-600 hover:bg-slate-100'
                                                        }`}
                                                >
                                                    End of Week
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 pt-2">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Day</label>
                                                    <select
                                                        value={formData.preferredWeekday || (formData.scheduleTiming === 'start_of_week' ? 'Monday' : 'Saturday')}
                                                        onChange={(e) => setFormData({ ...formData, preferredWeekday: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                                                    >
                                                        {weekdays.map((day) => (
                                                            <option key={day} value={day}>{day}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Time</label>
                                                    <input
                                                        type="time"
                                                        value={formData.preferredTime}
                                                        onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">When to Send?</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, scheduleTiming: 'start_of_month' })}
                                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${formData.scheduleTiming === 'start_of_month'
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-white text-slate-600 hover:bg-slate-100'
                                                        }`}
                                                >
                                                    Start of Month (1st)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, scheduleTiming: 'end_of_month' })}
                                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${formData.scheduleTiming === 'end_of_month'
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-white text-slate-600 hover:bg-slate-100'
                                                        }`}
                                                >
                                                    End of Month (Last)
                                                </button>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Time</label>
                                                <input
                                                    type="time"
                                                    value={formData.preferredTime}
                                                    onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Organization Details Section */}
                            <div className="pt-4 border-t border-slate-100">
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
                                    <Briefcase className="w-5 h-5 text-primary" />
                                    Organization Info
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-600 ml-1 uppercase tracking-wider">Intern / Student Name</label>
                                        <input
                                            type="text"
                                            value={formData.internName}
                                            onChange={(e) => setFormData({ ...formData, internName: e.target.value })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none text-slate-900 font-medium"
                                            placeholder="Student Name for Report"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-600 ml-1 uppercase tracking-wider">Organization Name</label>
                                        <input
                                            type="text"
                                            value={formData.organizationName}
                                            onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none text-slate-900 font-medium"
                                            placeholder="Official Organization Name"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-1 md:col-span-2">
                                        <label className="text-sm font-bold text-slate-600 ml-1 uppercase tracking-wider">Organization Logo (Optional)</label>
                                        <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-slate-50 border border-slate-200 rounded-2xl transition-all hover:bg-slate-100/50">
                                            <div className="relative group">
                                                {formData.organizationLogo ? (
                                                    <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-white flex items-center justify-center">
                                                        <img src={formData.organizationLogo} alt="Logo Preview" className="max-w-full max-h-full object-contain p-2" />
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, organizationLogo: '' })}
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition-all transform hover:scale-110 opacity-0 group-hover:opacity-100"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center bg-white text-slate-400 transition-colors group-hover:border-primary group-hover:text-primary">
                                                        <Upload className="w-8 h-8 mb-1" />
                                                        <span className="text-[10px] font-black uppercase">Logo</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 text-center sm:text-left">
                                                <h4 className="text-slate-900 font-bold text-sm mb-1">Company Branding</h4>
                                                <p className="text-slate-500 text-xs mb-4">This logo will appear on the generated attendance reports.</p>
                                                <input
                                                    type="file"
                                                    id="logo-upload"
                                                    onChange={handleImageUpload}
                                                    className="hidden"
                                                    accept="image/*"
                                                />
                                                <label
                                                    htmlFor="logo-upload"
                                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-extrabold text-slate-700 hover:border-primary hover:text-primary cursor-pointer transition-all active:scale-95 shadow-sm"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                    {formData.organizationLogo ? 'Change Brand Logo' : 'Choose Brand Logo'}
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 justify-end pt-6 border-t border-slate-100">
                                {configs.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(false)}
                                        className="px-8 py-4 border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 px-10 py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50"
                                >
                                    <Save className="w-5 h-5" />
                                    {saving ? 'Saving...' : currentConfigId ? 'Update Detail' : 'Save Recipient'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* Recipient List Mode */
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
                            {configs.map((config) => (
                                <div key={config._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden border-2 ${config.isEnabled ? 'bg-indigo-50 border-indigo-100/50 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                                                    {config.organizationLogo ? (
                                                        <img src={config.organizationLogo} alt="Org Logo" className="w-full h-full object-contain p-2" />
                                                    ) : (
                                                        <Mail className="w-6 h-6" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-extrabold text-slate-900 font-manrope">{config.recipientName}</h3>
                                                    <p className="text-slate-500 text-sm font-medium tracking-tight mb-1">{config.recipientEmail}</p>
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 tracking-wider">
                                                        {config.recipientRole}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEditRecipient(config)}
                                                    className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(config._id!)}
                                                    className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 bg-slate-50/80 p-5 rounded-2xl mb-6">
                                            <div>
                                                <div className="flex items-center gap-2 text-slate-400 mb-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Frequency</span>
                                                </div>
                                                <p className="text-slate-700 font-bold text-sm capitalize">{config.frequency}</p>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 text-slate-400 mb-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Send Time</span>
                                                </div>
                                                <p className="text-slate-700 font-bold text-sm">{config.preferredTime}</p>
                                            </div>
                                            <div className="col-span-2 pt-2 border-t border-slate-200/50">
                                                <div className="flex items-center gap-2 text-slate-400 mb-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Schedule</span>
                                                </div>
                                                <p className="text-slate-700 font-bold text-sm">
                                                    {config.scheduleTiming === 'start_of_week' && 'Start of Week (Monday)'}
                                                    {config.scheduleTiming === 'end_of_week' && `End of Week (${config.preferredWeekday || 'Saturday'})`}
                                                    {config.scheduleTiming === 'start_of_month' && 'Start of Month (1st)'}
                                                    {config.scheduleTiming === 'end_of_month' && 'End of Month (Last Day)'}
                                                </p>
                                            </div>
                                            <div className="col-span-2 pt-2 border-t border-slate-200/50">
                                                <div className="flex items-center gap-2 text-slate-400 mb-1">
                                                    <Briefcase className="w-3.5 h-3.5" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Report Subject</span>
                                                </div>
                                                <p className="text-slate-700 font-bold text-sm italic">{config.frequency === 'weekly' ? 'Weekly' : 'Monthly'} Report for {config.internName}</p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleToggle(config)}
                                            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${config.isEnabled
                                                ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-md'
                                                : 'bg-white border-2 border-slate-200 text-slate-400 hover:border-slate-300'
                                                }`}
                                        >
                                            <Power className={`w-4 h-4 ${config.isEnabled ? 'text-primary' : ''}`} />
                                            {config.isEnabled ? 'Active & Running' : 'Paused / Inactive'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Legend / Info */}
            <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-6 flex gap-4 items-start">
                <div className="bg-blue-100 p-2 rounded-lg mt-1">
                    <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h4 className="text-blue-900 font-extrabold text-sm uppercase tracking-wider mb-1">Pro Tip</h4>
                    <p className="text-blue-700 text-sm leading-relaxed font-medium">
                        Each recipient receives their own independent weekly report. Reports auto-advance dates every week without any input from you.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EmailAutomationSettings;
