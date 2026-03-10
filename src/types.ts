export type AttendanceMethod = 'QR' | 'ONE_TAP' | 'FACE_VERIFY';
export type AttendanceChannel = 'APP' | 'WEB' | 'ADMIN';
export type AttendanceSourceContext =
  | 'SELF_SERVICE'
  | 'MANUAL_ADJUST'
  | 'ISSUE_APPROVED'
  | 'LEAVE_APPROVED'
  | 'SYSTEM_CLOSE';
export type FaceVerifyReadiness = 'PLANNED' | 'ACTIVE';

export interface IAttendanceAccess {
  qr: {
    enabled: boolean;
    channels: AttendanceChannel[];
  };
  oneTap: {
    enabled: boolean;
    channels: AttendanceChannel[];
  };
  faceVerify: {
    enabled: boolean;
    channels: AttendanceChannel[];
    readiness: FaceVerifyReadiness;
  };
  defaultMethod: AttendanceMethod;
  allowLiveMethodSwitch: boolean;
}

// ClassBatch interface (Parent container for Sessions)
export interface IClassBatch {
  _id: string;
  name: string;
  description?: string;
  createdBy: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  lifecycleState?: string;
  defaultTime?: string; // HH:mm format
  defaultLocation?: string;
  useOrganizationGracePeriod?: boolean;
  gracePeriod?: number;
  organizationPrefix: string;
  createdAt: string;
  updatedAt: string;
  latestSessionDate?: string; // ISO date string - The latest end date/time among all sessions
  firstSession?: {
    _id: string;
    startDate: string;
    endDate?: string;
    startTime: string;
    endTime: string;
    locationType: string;
    physicalLocation?: string;
    virtualLocation?: string;
    location?: {
      type: 'LINK' | 'COORDS';
      link?: string;
      geolocation?: {
        latitude: number;
        longitude: number;
      };
    };
    frequency: 'OneTime' | 'Daily' | 'Weekly' | 'Monthly' | 'Random';
  };
  nextSession?: {
    _id: string;
    startDate: string;
    endDate?: string;
    startTime: string;
    endTime: string;
    locationType: string;
    physicalLocation?: string;
    virtualLocation?: string;
    location?: {
      type: 'LINK' | 'COORDS';
      link?: string;
      geolocation?: {
        latitude: number;
        longitude: number;
      };
    };
    frequency: 'OneTime' | 'Daily' | 'Weekly' | 'Monthly' | 'Random';
  } | null;
}

// Session interface matching the backend model
export interface ISession {
  _id: string;
  attendanceSessionId?: string | null;
  name: string;
  description?: string;
  frequency: 'OneTime' | 'Daily' | 'Weekly' | 'Monthly' | 'Random';
  startDate: string; // ISO date string (Series Start)
  occurrenceDate?: string; // YYYY-MM-DD (IST) - The actual instance date
  originalSessionId?: string; // If session is expanded, this is the rule ID
  endDate?: string; // ISO date string
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  locationType: 'Physical' | 'Virtual' | 'Hybrid';
  sessionType: 'PHYSICAL' | 'REMOTE' | 'HYBRID'; // New field: Physical, Remote, or Hybrid
  physicalLocation?: string;
  virtualLocation?: string;
  location?: {
    type: 'LINK' | 'COORDS';
    link?: string; // Google Maps link
    geolocation?: {
      latitude: number;
      longitude: number;
    };
  };
  geolocation?: {
    latitude: number;
    longitude: number;
  }; // Legacy field
  radius?: number;
  attendanceAccess?: IAttendanceAccess;
  availableMethods?: AttendanceMethod[];
  requirements?: string[];
  alreadyMarked?: boolean;
  markedVia?: string | null;
  assignedUsers: Array<{
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    mode: 'PHYSICAL' | 'REMOTE'; // Specific mode for this user (Physical or Remote)
    isLate?: boolean; // Whether this user marked attendance late
    attendanceStatus?: 'Present' | 'Absent'; // Attendance status: Present (scanned) or Absent (auto-marked)
  }>;
  weeklyDays?: string[];
  sessionAdmin?: string; // User ID of the SessionAdmin assigned to this session
  createdBy: string;
  organizationPrefix: string;
  classBatchId?: string | { _id: string; name: string; description?: string; }; // Reference to ClassBatch (can be populated)
  isCancelled?: boolean; // Whether the session has been cancelled
  cancellationReason?: string; // Reason for cancellation
  isCompleted?: boolean; // Whether the session has been processed for end-of-session attendance marking
  createdAt: string;
  updatedAt: string;
}

// My Attendance Record interface (attendance with populated session)
export interface IMyAttendanceRecord {
  _id: string;
  userId: string;
  sessionId: ISession | null; // Full session object or null if session was deleted
  classBatchId?: { _id: string; name: string } | null; // Reference to ClassBatch
  checkInTime?: string | null; // ISO date string
  checkOutTime?: string | null;
  attendanceStatus?: 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'LEAVE_APPROVED' | 'ON_LEAVE';
  attendanceDate?: string;
  isHalfDay?: boolean;
  isOnLeave?: boolean;
  locationVerified: boolean;
  isLate: boolean; // Whether this attendance was marked late
  lateByMinutes?: number; // Number of minutes late (if isLate is true)
  userLocation: {
    latitude: number;
    longitude: number;
  };
  deviceId: string;
  sourceContext?: AttendanceSourceContext;
  markingMethod?: AttendanceMethod | null;
  markingChannel?: AttendanceChannel | null;
  markedViaLabel?: string;
  securityChecks?: {
    deviceVerified?: boolean;
    locationVerified?: boolean;
    hardwareBackedKeyVerified?: boolean;
    qrVerified?: boolean;
    faceVerified?: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
}

