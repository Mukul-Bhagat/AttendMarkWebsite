import React, { useState, useRef, useEffect } from 'react';

interface ActionMenuProps {
    onManage: () => void;
    onView: () => void;
    onPdf: () => void;
    onCsv: () => void;
    disabled?: boolean;
}

const ActionMenu: React.FC<ActionMenuProps> = ({
    onManage,
    onView,
    onPdf,
    onCsv,
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Only close on click outside if NOT in mobile mode (fixed z-50 overlay handles mobile)
            // or if checking against the trigger button
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                // We let the backdrop handle mobile closing, but for desktop we need this
                // However, checking window.innerWidth here isn't reactive. 
                // Simplest is to just allow it, as the backdrop is an overlay on top of everything else on mobile.
                // But on mobile, the menu is fixed likely outside the ref if using React Portal... 
                // In this simple implementation, the menu is a child of the ref.
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleAction = (action: () => void) => {
        action();
        setIsOpen(false);
    };

    return (
        <>
            {/* Backdrop for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 sm:hidden animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div className="relative inline-block text-left" ref={menuRef}>
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors
            ${disabled
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-[#f04129] hover:bg-red-50 dark:hover:bg-slate-700 active:bg-red-100'
                        }
          `}
                    aria-label="Actions"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    title="Actions"
                >
                    <span className="material-symbols-outlined text-xl">more_vert</span>
                </button>

                {isOpen && (
                    <div
                        className={`
              z-50 bg-white dark:bg-slate-800 shadow-lg border-gray-100 dark:border-slate-700
              
              /* Mobile: Fixed Bottom Sheet */
              fixed bottom-0 left-0 right-0 w-full rounded-t-2xl border-t p-2
              animate-in slide-in-from-bottom duration-300
              
              /* Desktop: Absolute Dropdown */
              sm:absolute sm:right-0 sm:bottom-auto sm:left-auto sm:w-56 sm:rounded-xl sm:border sm:mt-2 sm:p-0
              sm:animate-in sm:fade-in sm:zoom-in-95 sm:duration-100
            `}
                        role="menu"
                    >
                        {/* Mobile Drag Handle / Header */}
                        <div className="flex flex-col items-center sm:hidden pb-2 pt-1">
                            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mb-3" />
                            <span className="text-gray-900 dark:text-white font-semibold text-lg">Actions</span>
                        </div>

                        <div className="flex flex-col sm:block py-1">
                            {/* Manage Attendance */}
                            <button
                                onClick={() => handleAction(onManage)}
                                className="w-full text-left flex items-center gap-4 sm:gap-3 px-4 py-3 sm:py-2.5 text-base sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors rounded-lg sm:rounded-none"
                                role="menuitem"
                            >
                                <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-xl sm:text-lg">group</span>
                                Manage Attendance
                            </button>

                            <div className="h-px bg-gray-100 dark:bg-slate-700 my-1 mx-2" />

                            {/* Downloads */}
                            <button
                                onClick={() => handleAction(onPdf)}
                                className="w-full text-left flex items-center gap-4 sm:gap-3 px-4 py-3 sm:py-2.5 text-base sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors rounded-lg sm:rounded-none"
                                role="menuitem"
                            >
                                <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-xl sm:text-lg">picture_as_pdf</span>
                                Download PDF
                            </button>

                            <button
                                onClick={() => handleAction(onCsv)}
                                className="w-full text-left flex items-center gap-4 sm:gap-3 px-4 py-3 sm:py-2.5 text-base sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors rounded-lg sm:rounded-none"
                                role="menuitem"
                            >
                                <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-xl sm:text-lg">grid_on</span>
                                Download Excel
                            </button>

                            <div className="h-px bg-gray-100 dark:bg-slate-700 my-1 mx-2" />

                            {/* View Action */}
                            <button
                                onClick={() => handleAction(onView)}
                                className="w-full text-left flex items-center gap-4 sm:gap-3 px-4 py-3 sm:py-2.5 text-base sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors rounded-lg sm:rounded-none"
                                role="menuitem"
                            >
                                <span className="material-symbols-outlined text-[#f04129] text-xl sm:text-lg">visibility</span>
                                View Details
                            </button>

                            {/* Mobile Cancel Button */}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="mt-2 w-full sm:hidden flex items-center justify-center p-3 text-base font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded-xl"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default ActionMenu;
