import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import RegisterSuperAdmin from './pages/RegisterSuperAdmin';
import LoginPage from './pages/LoginPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import Sessions from './pages/Sessions';
import CreateSession from './pages/CreateSession';
import EditClass from './pages/EditClass';
import SessionDetails from './pages/SessionDetails';
import ScanQR from './pages/ScanQR';
import MyAttendance from './pages/MyAttendance';
import MySessions from './pages/MySessions';
import AttendanceReport from './pages/AttendanceReport';
import ManageStaff from './pages/ManageStaff';
import ManageUsers from './pages/ManageUsers';
import EditSession from './pages/EditSession';
import Profile from './pages/Profile';
import Leaves from './pages/Leaves';
import QuickScanHandler from './pages/QuickScanHandler';
import PlatformDashboard from './pages/PlatformDashboard';
import PlatformAuditLogs from './pages/PlatformAuditLogs';
import DataBackup from './pages/DataBackup';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import Layout from './components/Layout';
import ForceResetPassword from './components/ForceResetPassword';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { user, isLoading } = useAuth();
  const showForceReset = !isLoading && user?.mustResetPassword === true;

  return (
    <div>
      {/* Force Password Reset Modal - Blocks entire app if mustResetPassword is true */}
      {showForceReset && <ForceResetPassword />}
      
      <Routes>
        {/* Public Routes - Redirect to dashboard if already logged in */}
        <Route 
          path="/landing" 
          element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <PublicRoute>
              <RegisterSuperAdmin />
            </PublicRoute>
          } 
        />
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />
        <Route 
          path="/forgot-password" 
          element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          } 
        />
        <Route 
          path="/reset-password/:collectionPrefix/:token" 
          element={
            <PublicRoute>
              <ResetPassword />
            </PublicRoute>
          } 
        />
        <Route 
          path="/" 
          element={
            isLoading ? (
              <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-8 w-8 text-primary mb-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                  </svg>
                  <p className="text-gray-600">Loading...</p>
                </div>
              </div>
            ) : user ? (
              user.role === 'PLATFORM_OWNER' ? (
                <Navigate to="/platform/dashboard" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        
        {/* Platform Owner Routes */}
        <Route element={<ProtectedRoute allowedRoles={['PLATFORM_OWNER']} />}>
          <Route element={<Layout />}>
            <Route path="/platform/dashboard" element={<PlatformDashboard />} />
            <Route path="/platform/audit-logs" element={<PlatformAuditLogs />} />
          </Route>
        </Route>

        {/* Protected Routes - Wrapped in ProtectedRoute and Layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            {/* Routes accessible to all authenticated users */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/scan" element={<ScanQR />} />
            <Route path="/my-attendance" element={<MyAttendance />} />
            <Route path="/my-sessions" element={<MySessions />} />
            <Route path="/leaves" element={<Leaves />} />
          </Route>
          {/* Deep Link Attendance - No Layout wrapper (full page) */}
          <Route path="/scan/:sessionId" element={<QuickScanHandler />} />
        </Route>
        
        {/* Classes routes - Accessible to all authenticated users (including EndUsers) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/classes" element={<Classes />} />
            <Route path="/classes/:classId/sessions" element={<Sessions />} />
          </Route>
        </Route>
        
        {/* Classes edit route - Only for Admins and Platform Owner */}
        <Route 
          element={<ProtectedRoute allowedRoles={['SuperAdmin', 'CompanyAdmin', 'Manager', 'SessionAdmin', 'PLATFORM_OWNER']} />}
        >
          <Route element={<Layout />}>
            <Route path="/classes/edit/:id" element={<EditClass />} />
          </Route>
        </Route>
        
        {/* Sessions routes - Accessible to all authenticated users (including EndUsers) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            {/* Redirect /sessions to /classes (remove global sessions list) */}
            <Route path="/sessions" element={<Navigate to="/classes" replace />} />
            <Route path="/sessions/:id" element={<SessionDetails />} />
          </Route>
        </Route>
        
        {/* Sessions edit route - Only for Admins and Platform Owner */}
        <Route 
          element={<ProtectedRoute allowedRoles={['SuperAdmin', 'CompanyAdmin', 'Manager', 'SessionAdmin', 'PLATFORM_OWNER']} />}
        >
          <Route element={<Layout />}>
            <Route path="/sessions/edit/:id" element={<EditSession />} />
          </Route>
        </Route>
        
        {/* Routes restricted to Manager, SuperAdmin, and Platform Owner */}
        <Route 
          element={<ProtectedRoute allowedRoles={['Manager', 'SuperAdmin', 'PLATFORM_OWNER']} />}
        >
          <Route element={<Layout />}>
            <Route path="/reports" element={<AttendanceReport />} />
          </Route>
        </Route>
        
        {/* Routes restricted to SuperAdmin, CompanyAdmin, Manager, SessionAdmin, and Platform Owner */}
        <Route 
          element={<ProtectedRoute allowedRoles={['SuperAdmin', 'CompanyAdmin', 'Manager', 'SessionAdmin', 'PLATFORM_OWNER']} />}
        >
          <Route element={<Layout />}>
            <Route path="/classes/create" element={<CreateSession />} />
            <Route path="/sessions/create" element={<CreateSession />} />
          </Route>
        </Route>
        
        {/* Routes restricted to SuperAdmin and Platform Owner */}
        <Route 
          element={<ProtectedRoute allowedRoles={['SuperAdmin', 'PLATFORM_OWNER']} />}
        >
          <Route element={<Layout />}>
            <Route path="/manage-staff" element={<ManageStaff />} />
          </Route>
        </Route>
        
        {/* Routes restricted to SuperAdmin, CompanyAdmin, and Platform Owner */}
        <Route 
          element={<ProtectedRoute allowedRoles={['SuperAdmin', 'CompanyAdmin', 'PLATFORM_OWNER']} />}
        >
          <Route element={<Layout />}>
            <Route path="/manage-users" element={<ManageUsers />} />
          </Route>
        </Route>
        
        {/* Data Backup - Only for CompanyAdmin and Platform Owner */}
        <Route 
          element={<ProtectedRoute allowedRoles={['CompanyAdmin', 'PLATFORM_OWNER']} />}
        >
          <Route element={<Layout />}>
            <Route path="/backup" element={<DataBackup />} />
            <Route path="/data-backup" element={<DataBackup />} /> {/* Keep for backward compatibility */}
          </Route>
        </Route>
      </Routes>
    </div>
  )
}

export default App


