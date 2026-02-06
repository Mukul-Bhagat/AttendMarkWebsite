import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import ProfileMenu from './ProfileMenu';
import Toast from './Toast';
import { useAutoBackup } from '../hooks/useAutoBackup';
import NotificationBell from './NotificationBell';
import RequestQueueNotification from './attendance/reporting/RequestQueueNotification';
import { getApiUrl } from '../utils/apiUrl';

const Layout: React.FC = () => {
  const { user, isSuperAdmin, isCompanyAdmin, isManager, isSessionAdmin, isPlatformOwner, isLoading } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Initialize auto-backup hook (runs silently in background for COMPANY_ADMIN only)
  const { toast, closeToast } = useAutoBackup();

  // Safety check: If user data is still loading or not available, show loading
  if (isLoading || !user || !user.profile) {
    return <LoadingSpinner />;
  }

  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/platform/dashboard') return 'Platform Dashboard';
    if (path === '/platform/audit-logs') return 'Audit Logs';
    if (path === '/dashboard') return 'Dashboard';
    if (path.startsWith('/classes')) return 'Classes/Batches';
    if (path.startsWith('/sessions')) return 'Sessions';
    if (path === '/scan') return 'Scan QR Code';
    if (path === '/my-attendance') return 'My Attendance';
    if (path === '/leaves') return 'Leave Management';
    if (path === '/reports') return 'Attendance Report';
    if (path === '/manage-staff') return 'Manage Staff';
    if (path.startsWith('/manage-users')) return 'Manage Users';
    if (path === '/backup' || path === '/data-backup') return 'Data Backup';
    if (path === '/email-automation') return 'Email Automation';
    return 'Dashboard';
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.profile?.firstName?.[0] && user?.profile?.lastName?.[0]) {
      return `${user.profile.firstName[0]}${user.profile.lastName[0]}`.toUpperCase();
    }
    if (user?.profile?.firstName?.[0]) {
      return user.profile.firstName[0].toUpperCase();
    }
    return 'U';
  };

  // Get profile picture URL
  const getProfilePictureUrl = () => {
    if (user?.profilePicture) {
      // Add cache-busting parameter to ensure fresh image loads
      const apiUrl = getApiUrl();
      return `${apiUrl}${user.profilePicture}`;
    }
    return null;
  };

  // Get role display name
  const getRoleDisplay = () => {
    if (!user?.role) return 'Guest';
    const roleMap: { [key: string]: string } = {
      'SuperAdmin': 'Company Administrator',
      'CompanyAdmin': 'Company Administrator',
      'Manager': 'Manager',
      'SessionAdmin': 'Session Administrator',
      'EndUser': 'End User',
      'PLATFORM_OWNER': 'Platform Owner',
    };
    return roleMap[user.role] || user.role;
  };

  // Get full user name
  const getUserName = () => {
    if (user?.profile?.firstName && user?.profile?.lastName) {
      return `${user.profile.firstName} ${user.profile.lastName}`;
    }
    if (user?.profile?.firstName) {
      return user.profile.firstName;
    }
    // Fallback to email if no name is available
    return user?.email || '';
  };

  // Navigation link component with active state styling
  const NavLinkItem = ({ to, icon, children, end }: { to: string; icon: string; children: React.ReactNode; end?: boolean }) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center py-2 px-6 text-sm font-medium border-l-4 transition-colors duration-200 ${isActive
          ? 'bg-red-50 dark:bg-[#f04129]/10 text-[#f04129] dark:text-[#f04129] border-[#f04129] [&_.material-symbols-outlined]:text-[#f04129]'
          : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-surface-dark/50 hover:text-text-primary-light dark:hover:text-text-primary-dark border-transparent'
        }`
      }
      onClick={() => setIsMobileMenuOpen(false)}
    >
      <span className="material-symbols-outlined mr-3 text-lg">{icon}</span>
      {children}
    </NavLink>
  );

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col h-screen sticky top-0 w-64 bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark shadow-sm">
        {/* Logo Header */}
        <div className="py-4 border-b border-border-light dark:border-border-dark flex items-center justify-center flex-shrink-0">
          <img
            src="/assets/attendmarklogo.png"
            alt="AttendMark Logo"
            className="block dark:hidden"
            style={{
              width: '140px',
              height: 'auto',
              objectFit: 'contain'
            }}
          />
          <img
            src="/assets/atendmarkwhitelogo.png"
            alt="AttendMark Logo"
            className="hidden dark:block"
            style={{
              width: '140px',
              height: 'auto',
              objectFit: 'contain'
            }}
          />
        </div>

        {/* Navigation Links - Scrollable middle section */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1">
            {/* Platform Owner Routes - Show only when on Platform pages */}
            {isPlatformOwner && (location.pathname.startsWith('/platform')) ? (
              <>
                <li>
                  <NavLinkItem to="/platform/dashboard" icon="dashboard">Platform Dashboard</NavLinkItem>
                </li>
                <li>
                  <NavLinkItem to="/platform/audit-logs" icon="history">Audit Logs</NavLinkItem>
                </li>
                <li>
                  <NavLinkItem to="/admin/notifications" icon="notifications">Notifications</NavLinkItem>
                </li>
              </>
            ) : (
              <>
                {/* Regular User Routes - Hide when Platform Owner is on Platform pages */}
                {(!isPlatformOwner || !location.pathname.startsWith('/platform')) && (
                  <>
                    <li>
                      <NavLinkItem to="/dashboard" icon="home">Dashboard</NavLinkItem>
                    </li>

                    {/* Classes/Batches - visible to all authenticated users (including EndUsers) */}
                    <li>
                      <NavLinkItem to="/classes" icon="groups" end={true}>Classes/Batches</NavLinkItem>
                    </li>

                    {/* Create Class/Batch - for SuperAdmin, CompanyAdmin, Manager, SessionAdmin, and Platform Owner */}
                    {(isSuperAdmin || isCompanyAdmin || isManager || isSessionAdmin || isPlatformOwner) && (
                      <li>
                        <NavLinkItem to="/classes/create" icon="calendar_add_on">Create Class/Batch</NavLinkItem>
                      </li>
                    )}

                    {/* Scan QR - visible to all authenticated users (except Platform Owner) */}
                    {!isPlatformOwner && (
                      <li>
                        <NavLinkItem to="/scan" icon="qr_code_scanner">Scan QR</NavLinkItem>
                      </li>
                    )}

                    {/* My Attendance - visible to all authenticated users (except Platform Owner) */}
                    {!isPlatformOwner && (
                      <li>
                        <NavLinkItem to="/my-attendance" icon="checklist">My Attendance</NavLinkItem>
                      </li>
                    )}

                    {/* Leaves - visible to all authenticated users (except Platform Owner) */}
                    {!isPlatformOwner && (
                      <li>
                        <NavLinkItem to="/leaves" icon="event">Leaves</NavLinkItem>
                      </li>
                    )}

                    {/* Attendance Report - for Manager, SuperAdmin, SessionAdmin, CompanyAdmin and Platform Owner */}
                    {(isSuperAdmin || isManager || isPlatformOwner || isSessionAdmin || isCompanyAdmin) && (
                      <li>
                        <NavLinkItem to="/reports" icon="summarize">Attendance Report</NavLinkItem>
                      </li>
                    )}

                    {/* Manage Staff - for SuperAdmin and Platform Owner */}
                    {(isSuperAdmin || isPlatformOwner) && (
                      <li>
                        <NavLinkItem to="/manage-staff" icon="work">Manage Staff</NavLinkItem>
                      </li>
                    )}

                    {/* Manage Users - for SuperAdmin, CompanyAdmin, and Platform Owner */}
                    {(isSuperAdmin || isCompanyAdmin || isPlatformOwner) && (
                      <li>
                        <NavLinkItem to="/manage-users" icon="manage_accounts">Manage Users</NavLinkItem>
                      </li>
                    )}
                    {/* Data Backup - for CompanyAdmin and Platform Owner */}
                    {(user?.role === 'CompanyAdmin' || user?.role === 'PLATFORM_OWNER') && (
                      <li>
                        <NavLinkItem to="/backup" icon="cloud_download">Data Backup</NavLinkItem>
                      </li>
                    )}


                    {/* Platform Owner Routes - Show when not on Platform pages */}
                    {isPlatformOwner && (
                      <>
                        <li className="pt-4 mt-4 border-t border-border-light dark:border-border-dark">
                          <NavLinkItem to="/platform/dashboard" icon="dashboard">Platform Dashboard</NavLinkItem>
                        </li>
                        <li>
                          <NavLinkItem to="/platform/audit-logs" icon="history">Audit Logs</NavLinkItem>
                        </li>
                        <li>
                          <NavLinkItem to="/admin/notifications" icon="notifications">Notifications</NavLinkItem>
                        </li>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </ul>
        </nav>

        {/* Bottom Section: User Card + Footer */}
        <div className="mt-auto border-t border-border-light dark:border-border-dark flex-shrink-0">
          {/* User Profile Card */}
          <div className="py-4 px-4">
            <div className="flex items-center space-x-3">
              {user?.profilePicture && user.profilePicture.trim() !== '' ? (
                <img
                  key={user.profilePicture} // Force re-render when profile picture changes
                  src={getProfilePictureUrl()!}
                  alt="Profile"
                  className="flex-shrink-0 size-10 rounded-full object-cover border-2 border-[#f04129]/20"
                />
              ) : (
                <div className="flex-shrink-0 size-10 rounded-full bg-[#fef2f2] border border-[#f04129] flex items-center justify-center text-[#991b1b] text-lg font-bold">
                  {getUserInitials()}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{getUserName()}</p>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{getRoleDisplay()}</p>
              </div>
            </div>
          </div>

          {/* Powered By AI ALLY Logo - Close to User Card */}
          <div className="px-4 pb-4">
            <a
              href="https://aially.in"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark font-medium">Powered By</p>
              <img
                src="/assets/image01.png"
                alt="AI ALLY Logo"
                className="block dark:hidden"
                style={{
                  height: '20px',
                  width: 'auto',
                  objectFit: 'contain'
                }}
              />
              <img
                src="/assets/aiallywhite.png"
                alt="AI ALLY Logo"
                className="hidden dark:block"
                style={{
                  height: '20px',
                  width: 'auto',
                  objectFit: 'contain'
                }}
              />
            </a>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark shadow-lg transform transition-transform duration-300 ease-in-out md:hidden flex flex-col h-screen ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between flex-shrink-0 px-4">
          <div className="flex items-center justify-center flex-1">
            <img
              src="/assets/attendmarklogo.png"
              alt="AttendMark Logo"
              className="block dark:hidden"
              style={{
                width: '140px',
                height: 'auto',
                objectFit: 'contain'
              }}
            />
            <img
              src="/assets/atendmarkwhitelogo.png"
              alt="AttendMark Logo"
              className="hidden dark:block"
              style={{
                width: '140px',
                height: 'auto',
                objectFit: 'contain'
              }}
            />
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Navigation Links - Scrollable middle section */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1">
            {/* Platform Owner Routes - Show only when on Platform pages */}
            {isPlatformOwner && location.pathname.startsWith('/platform') ? (
              <>
                <li>
                  <NavLinkItem to="/platform/dashboard" icon="dashboard">Platform Dashboard</NavLinkItem>
                </li>
                <li>
                  <NavLinkItem to="/platform/audit-logs" icon="history">Audit Logs</NavLinkItem>
                </li>
                <li>
                  <NavLinkItem to="/admin/notifications" icon="notifications">Notifications</NavLinkItem>
                </li>
              </>
            ) : (
              <>
                {/* Regular User Routes - Hide when Platform Owner is on Platform pages */}
                {(!isPlatformOwner || !location.pathname.startsWith('/platform')) && (
                  <>
                    <li>
                      <NavLinkItem to="/dashboard" icon="home">Dashboard</NavLinkItem>
                    </li>

                    {/* Classes/Batches - visible to all authenticated users (including EndUsers) */}
                    <li>
                      <NavLinkItem to="/classes" icon="groups" end={true}>Classes/Batches</NavLinkItem>
                    </li>

                    {/* Create Class/Batch - for SuperAdmin, CompanyAdmin, Manager, SessionAdmin, and Platform Owner */}
                    {(isSuperAdmin || isCompanyAdmin || isManager || isSessionAdmin || isPlatformOwner) && (
                      <li>
                        <NavLinkItem to="/classes/create" icon="calendar_add_on">Create Class/Batch</NavLinkItem>
                      </li>
                    )}

                    {!isPlatformOwner && (
                      <li>
                        <NavLinkItem to="/scan" icon="qr_code_scanner">Scan QR</NavLinkItem>
                      </li>
                    )}

                    {!isPlatformOwner && (
                      <li>
                        <NavLinkItem to="/my-attendance" icon="checklist">My Attendance</NavLinkItem>
                      </li>
                    )}

                    {!isPlatformOwner && (
                      <li>
                        <NavLinkItem to="/leaves" icon="event">Leaves</NavLinkItem>
                      </li>
                    )}

                    {(isSuperAdmin || isManager || isPlatformOwner || isSessionAdmin || isCompanyAdmin) && (
                      <li>
                        <NavLinkItem to="/reports" icon="summarize">Attendance Report</NavLinkItem>
                      </li>
                    )}

                    {(isSuperAdmin || isPlatformOwner) && (
                      <li>
                        <NavLinkItem to="/manage-staff" icon="work">Manage Staff</NavLinkItem>
                      </li>
                    )}

                    {(isSuperAdmin || isCompanyAdmin || isPlatformOwner) && (
                      <li>
                        <NavLinkItem to="/manage-users" icon="manage_accounts">Manage Users</NavLinkItem>
                      </li>
                    )}
                    {/* Data Backup - for CompanyAdmin and Platform Owner */}
                    {(user?.role === 'CompanyAdmin' || user?.role === 'PLATFORM_OWNER') && (
                      <li>
                        <NavLinkItem to="/backup" icon="cloud_download">Data Backup</NavLinkItem>
                      </li>
                    )}


                    {/* Platform Owner Routes - Show when not on Platform pages */}
                    {isPlatformOwner && (
                      <>
                        <li className="pt-4 mt-4 border-t border-border-light dark:border-border-dark">
                          <NavLinkItem to="/platform/dashboard" icon="dashboard">Platform Dashboard</NavLinkItem>
                        </li>
                        <li>
                          <NavLinkItem to="/platform/audit-logs" icon="history">Audit Logs</NavLinkItem>
                        </li>
                        <li>
                          <NavLinkItem to="/admin/notifications" icon="notifications">Notifications</NavLinkItem>
                        </li>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </ul>
        </nav>

        {/* Bottom Section: User Card + Footer */}
        <div className="mt-auto border-t border-border-light dark:border-border-dark flex-shrink-0">
          {/* User Profile Card */}
          <div className="py-4 px-4">
            <div className="flex items-center space-x-3">
              {user?.profilePicture && user.profilePicture.trim() !== '' ? (
                <img
                  key={user.profilePicture} // Force re-render when profile picture changes
                  src={getProfilePictureUrl()!}
                  alt="Profile"
                  className="flex-shrink-0 size-10 rounded-full object-cover border-2 border-[#f04129]/20"
                />
              ) : (
                <div className="flex-shrink-0 size-10 rounded-full bg-[#fef2f2] border border-[#f04129] flex items-center justify-center text-[#991b1b] text-lg font-bold">
                  {getUserInitials()}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{getUserName()}</p>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{getRoleDisplay()}</p>
              </div>
            </div>
          </div>

          {/* Powered By AI ALLY Logo - Close to User Card */}
          <div className="px-4 pb-4">
            <a
              href="https://aially.in"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark font-medium">Powered By</p>
              <img
                src="/assets/image01.png"
                alt="AI ALLY Logo"
                className="block dark:hidden"
                style={{
                  height: '20px',
                  width: 'auto',
                  objectFit: 'contain'
                }}
              />
              <img
                src="/assets/aiallywhite.png"
                alt="AI ALLY Logo"
                className="hidden dark:block"
                style={{
                  height: '20px',
                  width: 'auto',
                  objectFit: 'contain'
                }}
              />
            </a>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden bg-surface-light dark:bg-surface-dark px-4 py-3 border-b border-border-light dark:border-border-dark flex items-center justify-between shadow-sm sticky top-0 z-40 relative">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-text-primary-light dark:text-text-primary-dark flex items-center justify-center flex-shrink-0"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          {/* Logo - Absolutely Centered */}
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <img
              src="/assets/attendmarklogo.png"
              alt="AttendMark Logo"
              className="h-10 w-auto object-contain block dark:hidden"
            />
            <img
              src="/assets/atendmarkwhitelogo.png"
              alt="AttendMark Logo"
              className="h-10 w-auto object-contain hidden dark:block"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 🔔 Notification Bell - Mobile */}
            <NotificationBell />
            <ProfileMenu
              userInitials={getUserInitials()}
              userName={getUserName()}
              userRole={getRoleDisplay()}
              profilePicture={user?.profilePicture}
            />
          </div>
        </header>

        {/* Top Header - Desktop */}
        <header className="hidden md:flex sticky top-0 bg-surface-light dark:bg-surface-dark p-4 border-b border-border-light dark:border-border-dark z-30 items-center justify-between shadow-sm">
          <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">{getPageTitle()}</h1>
          <div className="flex items-center space-x-4">
            {/* 🔔 Notification Bell - ALWAYS VISIBLE FOR ALL ROLES */}
            <NotificationBell />
            <ProfileMenu
              userInitials={getUserInitials()}
              userName={getUserName()}
              userRole={getRoleDisplay()}
              profilePicture={user?.profilePicture}
            />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Toast Notification for Auto-Backup */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}
      {/* Admin Request Queue Notification */}
      <RequestQueueNotification />
    </div>
  );
};

export default Layout;

