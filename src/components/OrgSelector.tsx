import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';

import { appLogger } from '../shared/logger';
interface Organization {
  name: string;
  prefix: string;
}

interface OrgSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
}

const OrgSelector: React.FC<OrgSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = "Search for your organization...",
  className = "",
  inputRef,
}) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const actualInputRef = inputRef || internalInputRef;

  // Filter organizations based on search term
  const filteredOrgs = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return organizations;
    }
    const searchLower = searchTerm.toLowerCase();
    return organizations.filter((org) =>
      org.name.toLowerCase().includes(searchLower)
    );
  }, [organizations, searchTerm]);

  // Fetch organizations on mount
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setIsLoading(true);
        const { data } = await api.get('/api/auth/organizations');
        setOrganizations(data);
      } catch (err) {
        appLogger.error('Failed to fetch organizations:', err);
        setOrganizations([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganizations();
  }, []);

  // Sync searchTerm with value prop
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredOrgs]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    // Only open dropdown when user starts typing (input length > 0)
    setIsOpen(newValue.trim().length > 0);
  }, [onChange]);

  const handleSelectOrg = useCallback((orgName: string) => {
    setSearchTerm(orgName);
    onChange(orgName);
    setIsOpen(false);
    actualInputRef.current?.blur();
  }, [onChange, actualInputRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOrgs.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOrgs[highlightedIndex]) {
          handleSelectOrg(filteredOrgs[highlightedIndex].name);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }, [isOpen, filteredOrgs, highlightedIndex, handleSelectOrg]);

  const handleFocus = useCallback(() => {
    // Only open dropdown if there's text in the input
    if (searchTerm.trim().length > 0) {
      setIsOpen(true);
    }
  }, [searchTerm]);

  // Determine if className overrides default height/text size
  const hasHeightOverride = className?.includes('h-');
  const hasTextOverride = className?.includes('text-');
  const defaultClasses = `${!hasHeightOverride ? 'h-12 lg:h-14' : ''} ${!hasTextOverride ? 'text-base font-normal leading-normal' : ''}`;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input Field */}
      <div className="relative">
        <input
          ref={actualInputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className={`form-input flex w-full min-w-0 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-white focus:outline-0 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:border-[#f04129] focus:ring-2 focus:ring-[#f04129]/20 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 pr-10 disabled:opacity-50 disabled:cursor-not-allowed ${defaultClasses} ${className || ''}`}
        />
        {/* Dropdown Icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <span 
              className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
              style={{ fontSize: '20px' }}
            >
              expand_more
            </span>
          )}
        </div>
      </div>

      {/* Dropdown List - Only show when typing (searchTerm has value) */}
      {isOpen && !disabled && searchTerm.trim().length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg"
          role="listbox"
        >
          {isLoading ? (
            <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              Loading organizations...
            </li>
          ) : filteredOrgs.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              No organizations found
            </li>
          ) : (
            filteredOrgs.map((org, index) => (
              <li
                key={org.prefix}
                role="option"
                aria-selected={highlightedIndex === index}
                onClick={() => handleSelectOrg(org.name)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`px-4 py-3 text-sm cursor-pointer transition-colors ${
                  highlightedIndex === index
                    ? 'bg-[#f04129]/10 text-[#f04129]'
                    : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                } ${value === org.name ? 'font-semibold' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '18px' }}>
                    business
                  </span>
                  <span>{org.name}</span>
                  {value === org.name && (
                    <span className="material-symbols-outlined ml-auto text-[#f04129]" style={{ fontSize: '18px' }}>
                      check
                    </span>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default OrgSelector;

