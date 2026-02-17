
import React from 'react';
import GlassButton from '../common/GlassButton';
import PrimaryActionButton from '../common/PrimaryActionButton';

interface ActionHeaderProps {
    title: string;
    subtitle?: string;
    onImportClick?: () => void;
    onCreateClick: () => void;
    createLabel: string;
    showImport?: boolean;
}

const ActionHeader: React.FC<ActionHeaderProps> = ({
    title,
    subtitle,
    onImportClick,
    onCreateClick,
    createLabel,
    showImport = true,
}) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white mb-2">
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-gray-500 dark:text-gray-400 text-base">
                        {subtitle}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
                {showImport && onImportClick && (
                    <GlassButton label="Import CSV" onClick={onImportClick} />
                )}
                <PrimaryActionButton
                    label={createLabel}
                    onClick={onCreateClick}
                />
            </div>
        </div>
    );
};

export default ActionHeader;
