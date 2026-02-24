import { nowIST, istDayStart } from '../utils/time';
import { isRoleAllowed, resolveRole, Role, RoleProfile } from '../shared/roles';

/**
 * Attendance Permission Utilities
 *
 * Centralized permission checking for attendance-related operations
 */

export type AllowedRole = Role | RoleProfile;
export type AdminRole = Role | RoleProfile;

interface User {
    id?: string;
    email?: string;
    role?: string;
    rawRole?: string;
    canonicalRole?: Role;
    roleProfile?: RoleProfile;
    organizationId?: string;
    organizationName?: string;
}

const resolveUserRoleContext = (userOrRole: User | string) => {
    const rawRole = typeof userOrRole === 'string'
        ? userOrRole
        : String(userOrRole.rawRole || userOrRole.role || '');
    const resolved = resolveRole(rawRole);

    return {
        role: typeof userOrRole === 'string'
            ? resolved.role
            : userOrRole.canonicalRole || resolved.role,
        roleProfile: typeof userOrRole === 'string'
            ? resolved.roleProfile
            : userOrRole.roleProfile || resolved.roleProfile,
    };
};

/**
 * Check if a role can view attendance
 */
export function canViewAttendance(role: string): boolean {
    const ctx = resolveUserRoleContext(role);
    return (
        ctx.role === Role.PLATFORM_OWNER ||
        ctx.roleProfile === RoleProfile.SUPER_ADMIN ||
        ctx.roleProfile === RoleProfile.COMPANY_ADMIN ||
        ctx.roleProfile === RoleProfile.MANAGER
    );
}

/**
 * Check if a role can edit attendance
 */
export function canEditAttendance(role: string): boolean {
    return canViewAttendance(role);
}

/**
 * Check if a role can delete attendance records
 */
export function canDeleteAttendance(role: string): boolean {
    const ctx = resolveUserRoleContext(role);
    return (
        ctx.role === Role.PLATFORM_OWNER ||
        ctx.roleProfile === RoleProfile.SUPER_ADMIN ||
        ctx.roleProfile === RoleProfile.COMPANY_ADMIN
    );
}

/**
 * Check if a role can manually mark attendance
 */
export function canManuallyMarkAttendance(role: string): boolean {
    return canViewAttendance(role);
}

/**
 * Check if a role can view attendance reports
 */
export function canViewAttendanceReports(role: string): boolean {
    return canViewAttendance(role);
}

/**
 * Check if a role can export attendance data
 */
export function canExportAttendance(role: string): boolean {
    return canViewAttendance(role);
}

/**
 * Check if a role can manage attendance settings
 */
export function canManageAttendanceSettings(role: string): boolean {
    const ctx = resolveUserRoleContext(role);
    return (
        ctx.role === Role.PLATFORM_OWNER ||
        ctx.roleProfile === RoleProfile.SUPER_ADMIN ||
        ctx.roleProfile === RoleProfile.COMPANY_ADMIN
    );
}

// ============================================================================
// NEW: APPEND-ONLY ATTENDANCE ADJUSTMENT PERMISSIONS
// ============================================================================

/**
 * ⚠️ CRITICAL SECURITY FUNCTION ⚠️
 *
 * Central permission check for attendance adjustment with full audit trail
 */
export const canAdjustAttendance = (user: User | null | undefined): boolean => {
    if (!user) {
        return false;
    }

    const ctx = resolveUserRoleContext(user);
    return (
        ctx.role === Role.PLATFORM_OWNER ||
        ctx.roleProfile === RoleProfile.SUPER_ADMIN ||
        ctx.roleProfile === RoleProfile.COMPANY_ADMIN
    );
};

/**
 * Check if user can view audit trail (admin-only)
 */
export const canViewAuditTrail = (user: User | null | undefined): boolean => {
    if (!user) {
        return false;
    }

    const ctx = resolveUserRoleContext(user);
    return (
        ctx.role === Role.PLATFORM_OWNER ||
        ctx.roleProfile === RoleProfile.SUPER_ADMIN ||
        ctx.roleProfile === RoleProfile.COMPANY_ADMIN
    );
};

/**
 * Get user-friendly permission denied message
 */
export const getPermissionDeniedMessage = (user: User | null | undefined): string => {
    if (!user) {
        return 'You must be logged in to perform this action';
    }

    if (!user.role) {
        return 'Your account role is not set. Please contact support.';
    }

    const profile = resolveUserRoleContext(user).roleProfile;

    if (profile === RoleProfile.MANAGER) {
        return 'Only Company Admins can adjust attendance. Managers have read-only access.';
    }
    if (profile === RoleProfile.SESSION_ADMIN) {
        return 'Only Company Admins can adjust attendance. Session Admins have read-only access.';
    }
    if (profile === RoleProfile.END_USER) {
        return 'You do not have permission to adjust attendance.';
    }

    return 'Insufficient permissions to adjust attendance.';
};

/**
 * Validate if session can be adjusted (comprehensive check)
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
    if (user) {
        const userCtx = resolveUserRoleContext(user);
        if (userCtx.roleProfile === RoleProfile.COMPANY_ADMIN) {
            if (session.organizationId && user.organizationId) {
                if (session.organizationId.toString() !== user.organizationId.toString()) {
                    return {
                        allowed: false,
                        reason: 'You can only adjust attendance for your own organization'
                    };
                }
            }
        }
    }

    return { allowed: true };
};

/**
 * Permission constants for easy reference
 */
export const PERMISSION_ROLES = {
    CAN_ADJUST: [Role.COMPANY_ADMIN, RoleProfile.SUPER_ADMIN, Role.PLATFORM_OWNER],
    CAN_VIEW_AUDIT: [Role.COMPANY_ADMIN, RoleProfile.SUPER_ADMIN, Role.PLATFORM_OWNER],
    CAN_EXPORT: [Role.COMPANY_ADMIN, Role.PLATFORM_OWNER, RoleProfile.MANAGER, RoleProfile.SESSION_ADMIN],
    NO_ACCESS: [Role.USER]
} as const;

/**
 * Helper to check if user has any of the allowed roles
 */
export const hasAnyRole = (
    user: User | null | undefined,
    allowedRoles: readonly (Role | RoleProfile | string)[]
): boolean => {
    if (!user || !user.role) {
        return false;
    }

    return isRoleAllowed(user.role, [...allowedRoles], user.roleProfile);
};
