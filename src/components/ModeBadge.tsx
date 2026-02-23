import React from 'react';
import { normalizeSessionMode, type SessionMode } from '../utils/sessionMode';

interface ModeBadgeProps {
  mode: SessionMode | string;
  size?: 'sm' | 'md';
}

const MODE_STYLES: Record<SessionMode, string> = {
  PHYSICAL: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700',
  REMOTE: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-700',
  HYBRID: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-700',
};

const MODE_LABELS: Record<SessionMode, string> = {
  PHYSICAL: 'PHYSICAL',
  REMOTE: 'REMOTE',
  HYBRID: 'HYBRID',
};

const ModeBadge: React.FC<ModeBadgeProps> = ({ mode, size = 'sm' }) => {
  const normalizedMode = normalizeSessionMode(mode);
  const sizeClasses = size === 'md'
    ? 'px-3 py-1 text-xs'
    : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border font-semibold tracking-wide ${sizeClasses} ${MODE_STYLES[normalizedMode]}`}
    >
      {MODE_LABELS[normalizedMode]}
    </span>
  );
};

export default ModeBadge;
