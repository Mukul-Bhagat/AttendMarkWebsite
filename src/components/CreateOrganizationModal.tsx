import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../api';

interface CreateOrganizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        organizationName: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
    });
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const validateForm = (): boolean => {
        const newErrors: { [key: string]: string } = {};

        if (!formData.organizationName.trim()) {
            newErrors.organizationName = 'Organization Name is required';
        }
        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required';
        }
        if (!formData.lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        }
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            setIsSubmitting(true);
            setErrors({}); // Clear previous global errors

            // Call the new platform endpoint
            await api.post('/api/platform/create-organization', formData);

            setFormData({
                organizationName: '',
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                password: '',
            });
            onSuccess(); // Triggers refresh and close
        } catch (err: any) {
            console.error('Failed to create organization:', err);

            let errorMsg = 'Failed to create organization';

            if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
                // Formatting express-validator errors
                errorMsg = err.response.data.errors.map((e: any) => e.msg).join(', ');
            } else if (err.response?.data?.msg) {
                errorMsg = err.response.data.msg;
            }

            setErrors(prev => ({ ...prev, submit: errorMsg }));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-border-light dark:border-border-dark sticky top-0 bg-surface-light dark:bg-surface-dark z-10">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
                            Create New Organization
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4" autoComplete="off">
                    {/* Organization Name */}
                    <div>
                        <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
                            Organization Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="organizationName"
                            value={formData.organizationName}
                            onChange={handleInputChange}
                            className={`w-full px-3 py-2 rounded-lg border ${errors.organizationName
                                ? 'border-red-500'
                                : 'border-border-light dark:border-border-dark'
                                } bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary`}
                            placeholder="e.g. Acme Corp"
                        />
                        {errors.organizationName && (
                            <p className="text-red-500 text-xs mt-1">{errors.organizationName}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* First Name */}
                        <div>
                            <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
                                First Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 rounded-lg border ${errors.firstName
                                    ? 'border-red-500'
                                    : 'border-border-light dark:border-border-dark'
                                    } bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary`}
                                placeholder="Admin First Name"
                            />
                            {errors.firstName && (
                                <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                            )}
                        </div>

                        {/* Last Name */}
                        <div>
                            <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
                                Last Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 rounded-lg border ${errors.lastName
                                    ? 'border-red-500'
                                    : 'border-border-light dark:border-border-dark'
                                    } bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary`}
                                placeholder="Admin Last Name"
                            />
                            {errors.lastName && (
                                <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                            )}
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
                            Admin Email <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className={`w-full px-3 py-2 rounded-lg border ${errors.email
                                ? 'border-red-500'
                                : 'border-border-light dark:border-border-dark'
                                } bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary`}
                            placeholder="admin@company.com"
                        />
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                            Credentials will be sent to this email.
                        </p>
                        {errors.email && (
                            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                        )}
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
                            Phone (Optional)
                        </label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Phone number"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
                            Initial Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                className={`w-full px-3 py-2 rounded-lg border ${errors.password
                                    ? 'border-red-500'
                                    : 'border-border-light dark:border-border-dark'
                                    } bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary pr-10`}
                                placeholder="Min. 6 characters"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
                            >
                                <span className="material-symbols-outlined text-lg">
                                    {showPassword ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                        {errors.password && (
                            <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                        )}
                    </div>

                    {/* Submit Error */}
                    {errors.submit && (
                        <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm">
                            {errors.submit}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-border-light dark:border-border-dark">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-text-primary-light dark:text-text-primary-dark bg-transparent hover:bg-gray-100 dark:hover:bg-surface-dark rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 text-sm font-bold text-white bg-[#f04129] hover:bg-[#d63a25] rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                                    </svg>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">add_business</span>
                                    Create Organization
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateOrganizationModal;
