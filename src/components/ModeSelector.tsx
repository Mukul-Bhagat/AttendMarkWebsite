import React from 'react';
import { SessionMode } from '../utils/sessionMode';

interface ModeSelectorProps {
  value: SessionMode;
  onChange: (mode: SessionMode) => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ value, onChange }) => {
  const buildButtonClass = (mode: SessionMode) =>
    `relative flex flex-col items-center justify-center rounded-xl border-2 p-5 text-center shadow-sm transition-all duration-200 ${
      value === mode
        ? 'border-[#f04129] dark:border-[#f04129]'
        : 'border-[#e6e2db] hover:border-[#d6d0c6] dark:border-slate-700 dark:hover:border-slate-600'
    }`;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <button
        type="button"
        onClick={() => onChange('PHYSICAL')}
        className={buildButtonClass('PHYSICAL')}
      >
        {value === 'PHYSICAL' && (
          <span className="material-symbols-outlined absolute right-3 top-3 text-xl text-[#f04129]">check_circle</span>
        )}
        <span className={`material-symbols-outlined mb-2 text-3xl ${value === 'PHYSICAL' ? 'text-[#f04129]' : 'text-[#5c5445] dark:text-slate-400'}`}>
          location_on
        </span>
        <p className="font-semibold text-[#181511] dark:text-white">Physical</p>
      </button>
      <button
        type="button"
        onClick={() => onChange('REMOTE')}
        className={buildButtonClass('REMOTE')}
      >
        {value === 'REMOTE' && (
          <span className="material-symbols-outlined absolute right-3 top-3 text-xl text-[#f04129]">check_circle</span>
        )}
        <span className={`material-symbols-outlined mb-2 text-3xl ${value === 'REMOTE' ? 'text-[#f04129]' : 'text-[#5c5445] dark:text-slate-400'}`}>
          desktop_windows
        </span>
        <p className="font-semibold text-[#181511] dark:text-white">Remote</p>
      </button>
      <button
        type="button"
        onClick={() => onChange('HYBRID')}
        className={buildButtonClass('HYBRID')}
      >
        {value === 'HYBRID' && (
          <span className="material-symbols-outlined absolute right-3 top-3 text-xl text-[#f04129]">check_circle</span>
        )}
        <span className={`material-symbols-outlined mb-2 text-3xl ${value === 'HYBRID' ? 'text-[#f04129]' : 'text-[#5c5445] dark:text-slate-400'}`}>
          hub
        </span>
        <p className="font-semibold text-[#181511] dark:text-white">Hybrid</p>
      </button>
    </div>
  );
};

export default ModeSelector;
