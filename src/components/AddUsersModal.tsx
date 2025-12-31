import React, { useState, useEffect, useRef } from 'react';
import api from '../api';

// Define the User shape
interface IUser {
  _id: string;
  email: string;
  role: string;
  profile: {
    firstName: string;
    lastName: string;
  };
}

interface IProps {
  onClose: () => void;
  onSave: (users: IUser[]) => void;
  initialSelectedUsers: IUser[];
  context?: string; // Optional: Context/title to show which group is being added (e.g., "Physical Attendees" or "Remote Attendees")
}

const AddUsersModal: React.FC<IProps> = ({ onClose, onSave, initialSelectedUsers, context }) => {
  const [allUsers, setAllUsers] = useState<IUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Map<string, IUser>>(
    new Map(initialSelectedUsers.map(u => [u._id, u]))
  );
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch all users from the organization
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await api.get('/api/users/my-organization');
        setAllUsers(data);
        if (data.length === 0) {
          setError('No users found in your organization');
        }
      } catch (error: any) {
        console.error('Failed to fetch users', error);
        setError('Failed to load users. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Handle ESC key to close modal and auto-focus search
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    // Auto-focus search input when modal opens
    if (!isLoading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, isLoading]);

  const handleSelectUser = (user: IUser) => {
    setSelectedUsers(prev => {
      const newMap = new Map(prev);
      if (newMap.has(user._id)) {
        newMap.delete(user._id);
      } else {
        newMap.set(user._id, user);
      }
      return newMap;
    });
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length && filteredUsers.length > 0) {
      // Deselect all
      setSelectedUsers(new Map());
    } else {
      // Select all from current filter
      const newMap = new Map(selectedUsers);
      filteredUsers.forEach(user => newMap.set(user._id, user));
      setSelectedUsers(newMap);
    }
  };

  const handleSave = () => {
    onSave(Array.from(selectedUsers.values()));
    onClose();
  };

  const filteredUsers = allUsers.filter(user =>
    user.email.toLowerCase().includes(searchText.toLowerCase()) ||
    `${user.profile.firstName} ${user.profile.lastName}`.toLowerCase().includes(searchText.toLowerCase())
  );

  const allSelected = filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border-light dark:border-border-dark">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
              {context || 'Add Users to Session'}
            </h2>
            <button
              onClick={onClose}
              className="text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b border-border-light dark:border-border-dark">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark">
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark placeholder:text-text-secondary-light dark:placeholder:text-text-secondary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-text-secondary-light dark:text-text-secondary-dark">Loading users...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <span className="material-symbols-outlined text-red-500 text-4xl mb-2">error</span>
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-text-secondary-light dark:text-text-secondary-dark">
                {searchText ? 'No users found matching your search' : 'No users available'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Select All Checkbox */}
              <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-dark/50 transition-colors border-b border-border-light dark:border-border-dark pb-4 mb-2">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="w-5 h-5 rounded border-border-light dark:border-border-dark text-primary focus:ring-primary focus:ring-2 cursor-pointer"
                />
                <label 
                  htmlFor="select-all" 
                  className="flex-1 text-sm font-medium text-text-primary-light dark:text-text-primary-dark cursor-pointer"
                >
                  Select All ({filteredUsers.length})
                </label>
              </div>

              {/* User List */}
              <div className="space-y-1">
                {filteredUsers.map(user => {
                  const isSelected = selectedUsers.has(user._id);
                  return (
                    <div
                      key={user._id}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-gray-50 dark:hover:bg-surface-dark/50'
                      }`}
                      onClick={() => handleSelectUser(user)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectUser(user)}
                        className="w-5 h-5 rounded border-border-light dark:border-border-dark text-primary focus:ring-primary focus:ring-2 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                            {user.profile.firstName} {user.profile.lastName}
                          </p>
                        </div>
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                          {user.email}
                        </p>
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                          {user.role}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Selected Count and Actions */}
        <div className="p-6 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-background-dark/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
                {selectedUsers.size}
              </span>{' '}
              {selectedUsers.size === 1 ? 'User' : 'Users'} selected
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 text-sm font-medium text-text-primary-light dark:text-text-primary-dark bg-transparent hover:bg-gray-100 dark:hover:bg-surface-dark rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 text-sm font-bold text-white bg-primary hover:bg-[#d63a25] rounded-lg transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Save ({selectedUsers.size})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddUsersModal;
