import React, { useEffect, useRef } from 'react';

export interface RowActionMenuItem {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  hidden?: boolean;
  title?: string;
}

interface RowActionMenuProps {
  menuId: string;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  items: RowActionMenuItem[];
}

const RowActionMenu: React.FC<RowActionMenuProps> = ({
  menuId,
  openMenuId,
  setOpenMenuId,
  items,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isOpen = openMenuId === menuId;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setOpenMenuId]);

  const visibleItems = items.filter((item) => !item.hidden);
  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setOpenMenuId(isOpen ? null : menuId)}
        className="text-gray-400 hover:text-gray-500 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="material-symbols-outlined text-xl">more_vert</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 z-50 divide-y divide-gray-100 dark:divide-gray-700">
          <div className="py-1">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.disabled) {
                    return;
                  }
                  setOpenMenuId(null);
                  item.onClick();
                }}
                disabled={item.disabled}
                title={item.title}
                className={`group flex w-full items-center px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  item.danger
                    ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {item.icon && (
                  <span className={`material-symbols-outlined text-lg mr-3 ${item.danger ? '' : 'text-gray-400 group-hover:text-gray-500'}`}>
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RowActionMenu;
