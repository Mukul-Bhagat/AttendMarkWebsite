
import React from 'react';
import { ArrowRight } from 'lucide-react';

interface PrimaryActionButtonProps {
    label: string;
    onClick: () => void;
}

const PrimaryActionButton: React.FC<PrimaryActionButtonProps> = ({ label, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="
        inline-flex items-center gap-3
        px-6 py-2.5 rounded-full
        bg-gradient-to-r from-red-500 to-orange-500
        text-white font-semibold
        shadow-lg
        hover:shadow-xl
        hover:scale-[0.98]
        transition-all duration-300
      "
        >
            {label}
            <span className="
        flex items-center justify-center
        w-8 h-8 rounded-full
        bg-black/20
      ">
                <ArrowRight size={16} />
            </span>
        </button>
    );
};

export default PrimaryActionButton;
