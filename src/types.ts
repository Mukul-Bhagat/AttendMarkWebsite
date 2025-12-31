// ClassBatch interface (Parent container for Sessions)
export interface IClassBatch {
  _id: string;
  name: string;
  description?: string;
  createdBy: string;
  defaultTime?: string; // HH:mm format
  defaultLocation?: string;
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
}

// Session interface matching the backend model
export interface ISession {
  _id: string;
  name: string;
  description?: string;
  frequency: 'OneTime' | 'Daily' | 'Weekly' | 'Monthly' | 'Random';
  startDate: string; // ISO date string
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
  checkInTime: string; // ISO date string
  locationVerified: boolean;
  isLate: boolean; // Whether this attendance was marked late
  lateByMinutes?: number; // Number of minutes late (if isLate is true)
  userLocation: {
    latitude: number;
    longitude: number;
  };
  deviceId: string;
  createdAt: string;
  updatedAt: string;
}

