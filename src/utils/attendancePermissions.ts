import { nowIST, istDayStart } from '../utils/time';

/**
 * Attendance Permission Utilities
 * 
 * Centralized permission checking for attendance-related operations
 */

export type AllowedRole = 'PLATFORM_OWNER' | 'SuperAdmin' | 'CompanyAdmin' | 'Manager';
export type AdminRole = 'PLATFORM_OWNER' | 'SuperAdmin' | 'CompanyAdmin';

interface User {
    id?: string;
    email?: string;
    role?: string;
    organizationId?: string;
    organizationName?: string;
}

/**
 * Check if a role can view attendance
 */
export function canViewAttendance(role: string): boolean {
    const allowedRoles: string[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin', 'Manager'];
    return allowedRoles.includes(role);
}

/**
 * Check if a role can edit attendance
 */
export function canEditAttendance(role: string): boolean {
    const allowedRoles: string[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin', 'Manager'];
    return allowedRoles.includes(role);
}

/**
 * Check if a role can delete attendance records
 */
export function canDeleteAttendance(role: string): boolean {
    const allowedRoles: string[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin'];
    return allowedRoles.includes(role);
}

/**
 * Check if a role can manually mark attendance
 */
export function canManuallyMarkAttendance(role: string): boolean {
    const allowedRoles: string[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin', 'Manager'];
    return allowedRoles.includes(role);
}

/**
 * Check if a role can view attendance reports
 */
export function canViewAttendanceReports(role: string): boolean {
    const allowedRoles: string[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin', 'Manager'];
    return allowedRoles.includes(role);
}

/**
 * Check if a role can export attendance data
 */
export function canExportAttendance(role: string): boolean {
    const allowedRoles: string[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin', 'Manager'];
    return allowedRoles.includes(role);
}

/**
 * Check if a role can manage attendance settings
 */
export function canManageAttendanceSettings(role: string): boolean {
    const allowedRoles: string[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin'];
    return allowedRoles.includes(role);
}

// ============================================================================
// NEW: APPEND-ONLY ATTENDANCE ADJUSTMENT PERMISSIONS
// ============================================================================

/**
 * ⚠️ CRITICAL SECURITY FUNCTION ⚠️
 * 
 * Central permission check for attendance adjustment with full audit trail
 * 
 * SECURITY RULE:
 * - NEVER rely on component-level checks alone
 * - Permission check must be called before rendering ANY edit control
 * - Backend enforces, frontend prevents accidental access
 * 
 * ROLES WITH ADJUSTMENT PERMISSION:
 * - CompanyAdmin (own organization only)
 * - PLATFORM_OWNER (all organizations)
 * 
 * ROLES WITHOUT PERMISSION (HARD BLOCK):
 * - Manager (read-only)
 * - SessionAdmin (read-only)
 * - EndUser (no access)
 * 
 * @param user - Current authenticated user
 * @returns true if user can adjust attendance, false otherwise
 * 
 * @example
 * ```tsx
 * import { canAdjustAttendance } from '@/utils/attendancePermissions';
 * 
 * // In component (MANDATORY PATTERN):
 * {canAdjustAttendance(currentUser) && (
 *   <EditAttendanceButton />
 * )}
 * ```
 */
export const canAdjustAttendance = (user: User | null | undefined): boolean => {
    if (!user || !user.role) {
        return false;
    }

    // STRICT: CompanyAdmin, SuperAdmin, SUPER_ADMIN, and PLATFORM_OWNER
    return (
        user.role === 'CompanyAdmin' ||
        user.role === 'SuperAdmin' ||
        user.role === 'SUPER_ADMIN' ||
        user.role === 'PLATFORM_OWNER'
    );
};

/**
 * Check if user can view audit trail (more permissive than adjustment)
 * 
 * @param user - Current authenticated user
 * @returns true if user can view attendance history
 * 
 * Permissions:
 * - PLATFORM_OWNER: Full access to all org audit trails
 * - CompanyAdmin: Full access to own org
 * - Manager: Read-only access to own classes
 * - SessionAdmin: Read-only access to own sessions
 * - EndUser: No access
 */
export const canViewAuditTrail = (user: User | null | undefined): boolean => {
    if (!user || !user.role) {
        return false;
    }

    return (
        user.role === 'CompanyAdmin' ||
        user.role === 'PLATFORM_OWNER' ||
        user.role === 'Manager' ||
        user.role === 'SessionAdmin'
    );
};

/**
 * Get user-friendly permission denied message
 * 
 * @param user - Current authenticated user
 * @returns Human-readable explanation of why action is not allowed
 */
export const getPermissionDeniedMessage = (user: User | null | undefined): string => {
    if (!user) {
        return 'You must be logged in to perform this action';
    }

    if (!user.role) {
        return 'Your account role is not set. Please contact support.';
    }

    const roleMessages: Record<string, string> = {
        'Manager': 'Only Company Admins can adjust attendance. Managers have read-only access.',
        'SessionAdmin': 'Only Company Admins can adjust attendance. You can view audit history.',
        'EndUser': 'You do not have permission to adjust attendance.',
        'default': 'Insufficient permissions to adjust attendance.'
    };

    return roleMessages[user.role] || roleMessages['default'];
};

/**
 * Validate if session can be adjusted (comprehensive check)
 * 
 * @param session - Session object
 * @param user - Current user
 * @returns { allowed: boolean, reason?: string }
 */
export const canAdjustSession = (
    session: any,
    user: User | null | undefined
): { allowed: boolean; reason?: string } => {
    // First check user permissions
    if (!canAdjustAttendance(user)) {
        return {
            allowed: false,
            reason: getPermissionDeniedMessage(user)
        };
    }

    // Check if session exists
    if (!session) {
        return {
            allowed: false,
            reason: 'Session not found'
        };
    }

    // Check session age (frontend pre-check, backend enforces)
    const sessionStartTimestamp = istDayStart(session.startDate);
    const nowTimestamp = nowIST();
    const ageDays = (nowTimestamp - sessionStartTimestamp) / (1000 * 60 * 60 * 24);

    if (ageDays > 90) {
        return {
            allowed: false,
            reason: 'Cannot adjust attendance for sessions older than 90 days'
        };
    }

    // Check if future session
    if (sessionStartTimestamp > nowTimestamp) {
        return {
            allowed: false,
            reason: 'Cannot adjust attendance for future sessions'
        };
    }

    // Cross-org check for CompanyAdmin
    if (user?.role === 'CompanyAdmin') {
        if (session.organizationId && user.organizationId) {
            if (session.organizationId.toString() !== user.organizationId.toString()) {
                return {
                    allowed: false,
                    reason: 'You can only adjust attendance for your own organization'
                };
            }
        }
    }

    return { allowed: true };
};

/**
 * Permission constants for easy reference
 */
export const PERMISSION_ROLES = {
    CAN_ADJUST: ['CompanyAdmin', 'SuperAdmin', 'SUPER_ADMIN', 'PLATFORM_OWNER'],
    CAN_VIEW_AUDIT: ['CompanyAdmin', 'PLATFORM_OWNER', 'Manager', 'SessionAdmin'],
    CAN_EXPORT: ['CompanyAdmin', 'PLATFORM_OWNER', 'Manager', 'SessionAdmin'],
    NO_ACCESS: ['EndUser']
} as const;

/**
 * Helper to check if user has any of the allowed roles
 */
export const hasAnyRole = (
    user: User | null | undefined,
    allowedRoles: readonly string[]
): boolean => {
    if (!user || !user.role) {
        return false;
    }

    return allowedRoles.includes(user.role);
};

