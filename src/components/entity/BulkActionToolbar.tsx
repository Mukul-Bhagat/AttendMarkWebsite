import React from 'react';

export interface BulkToolbarAction {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  hidden?: boolean;
  danger?: boolean;
  title?: string;
}

interface BulkActionToolbarProps {
  selectedCount: number;
  entityLabel: string;
  actions: BulkToolbarAction[];
  onClear: () => void;
}

const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  selectedCount,
  entityLabel,
  actions,
  onClear,
}) => {
  const visibleActions = actions.filter((action) => !action.hidden);

  return (
    <div className="sticky top-4 z-30 mb-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur shadow-lg px-4 py-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {selectedCount} {entityLabel}{selectedCount > 1 ? 's' : ''} selected
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {visibleActions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.title}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                action.danger
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              {action.icon && <span className="material-symbols-outlined text-base">{action.icon}</span>}
              {action.label}
            </button>
          ))}
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <span className="material-symbols-outlined text-base">clear</span>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActionToolbar;
