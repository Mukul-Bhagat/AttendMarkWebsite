
import React from 'react';
import { Upload } from 'lucide-react';

interface GlassButtonProps {
    label: string;
    onClick: () => void;
}

const GlassButton: React.FC<GlassButtonProps> = ({ label, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="
        relative inline-flex items-center gap-2
        px-6 py-2.5 rounded-full
        bg-white/20 dark:bg-white/10
        backdrop-blur-md
        border border-white/30 dark:border-white/20
        text-gray-800 dark:text-gray-100
        shadow-md
        hover:scale-[0.97]
        transition-all duration-300
      "
        >
            <Upload size={18} />
            {label}
        </button>
    );
};

export default GlassButton;
