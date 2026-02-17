
import React from 'react';
import { X } from 'lucide-react';

interface EntityFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const EntityFormModal: React.FC<EntityFormModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="
        bg-white dark:bg-gray-900
        w-full max-w-2xl
        rounded-2xl
        shadow-2xl
        p-6
        animate-fade-in
        relative
      ">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                        {title}
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <X className="text-gray-500 hover:text-red-500" size={24} />
                    </button>
                </div>

                {/* Form content */}
                <div className="max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default EntityFormModal;
