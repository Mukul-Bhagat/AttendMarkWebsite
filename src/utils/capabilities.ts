/**
 * ============================================================================
 * FRONTEND CAPABILITY SYSTEM
 * ============================================================================
 *
 * Purpose: Client-side capability checks for permission-based UI rendering
 *
 * Critical Rule: Buttons must be HIDDEN (not rendered), not just disabled
 *
 * Security: This is UI-level only. Backend MUST enforce all permissions.
 *
 * ============================================================================
 */

import { resolveRole, Role, RoleProfile } from '../shared/roles';

export enum Capability {
    ATTENDANCE_ADJUST = 'ATTENDANCE_ADJUST',
    ATTENDANCE_VIEW = 'ATTENDANCE_VIEW',
    ATTENDANCE_EXPORT = 'ATTENDANCE_EXPORT',
    AUDIT_VIEW = 'AUDIT_VIEW',
}

const FULL_ATTENDANCE_CAPABILITIES = [
    Capability.ATTENDANCE_ADJUST,
    Capability.ATTENDANCE_VIEW,
    Capability.ATTENDANCE_EXPORT,
    Capability.AUDIT_VIEW,
];

const READ_ONLY_ATTENDANCE_CAPABILITIES = [
    Capability.ATTENDANCE_VIEW,
    Capability.AUDIT_VIEW,
    Capability.ATTENDANCE_EXPORT,
];

const resolveUserContext = (user: any): { role: Role; roleProfile: RoleProfile } | null => {
    if (!user) return null;

    try {
        const roleSource = String(user.rawRole || user.role || '');
        const resolved = resolveRole(roleSource);
        return {
            role: user.canonicalRole || resolved.role,
            roleProfile: user.roleProfile || resolved.roleProfile,
        };
    } catch {
        return null;
    }
};

/**
 * Generic capability check
 * Capabilities come from JWT payload (Phase 1 backend)
 *
 * @param user - User object from context (contains role and optionally capabilities array)
 * @param capability - Capability to check
 * @returns true if user has capability, false otherwise
 */
export function hasCapability(
    user: any,
    capability: Capability
): boolean {
    if (!user) return false;

    // PREFERRED: capabilities array from backend JWT
    if (Array.isArray(user.capabilities)) {
        return user.capabilities.includes(capability);
    }

    const ctx = resolveUserContext(user);
    if (!ctx) return false;

    if (ctx.role === Role.PLATFORM_OWNER) return true;

    if (
        ctx.roleProfile === RoleProfile.COMPANY_ADMIN ||
        ctx.roleProfile === RoleProfile.SUPER_ADMIN
    ) {
        return FULL_ATTENDANCE_CAPABILITIES.includes(capability);
    }

    if (ctx.roleProfile === RoleProfile.MANAGER) {
        return READ_ONLY_ATTENDANCE_CAPABILITIES.includes(capability);
    }

    return false;
}

/**
 * Force mark permission (DEPRECATED - redirects to canAdjustAttendance)
 *
 * @deprecated Use canAdjustAttendance instead
 * @param user - User object
 * @returns true if user can adjust attendance
 */
export function canForceMarkAttendance(user: any): boolean {
    // Force mark removed - redirect to adjust attendance
    return canAdjustAttendance(user);
}

/**
 * Adjust attendance permission (manual corrections)
 *
 * @param user - User object
 * @returns true if user can adjust attendance
 */
export function canAdjustAttendance(user: any): boolean {
    return hasCapability(user, Capability.ATTENDANCE_ADJUST);
}

/**
 * View audit trail permission
 *
 * @param user - User object
 * @returns true if user can view audit logs
 */
export function canViewAudit(user: any): boolean {
    return hasCapability(user, Capability.AUDIT_VIEW);
}

/**
 * View attendance permission
 *
 * @param user - User object
 * @returns true if user can view attendance
 */
export function canViewAttendance(user: any): boolean {
    return hasCapability(user, Capability.ATTENDANCE_VIEW);
}

/**
 * Export attendance permission
 *
 * @param user - User object
 * @returns true if user can export attendance data
 */
export function canExportAttendance(user: any): boolean {
    return hasCapability(user, Capability.ATTENDANCE_EXPORT);
}

/**
 * Helper to check if user has global scope (PLATFORM_OWNER)
 *
 * @param user - User object
 * @returns true if user is PLATFORM_OWNER
 */
export function hasGlobalScope(user: any): boolean {
    const ctx = resolveUserContext(user);
    return ctx?.role === Role.PLATFORM_OWNER;
}

/**
 * Helper to check if user is org-scoped admin
 *
 * @param user - User object
 * @returns true if user is CompanyAdmin/SuperAdmin (not PLATFORM_OWNER)
 */
export function isOrgScopedAdmin(user: any): boolean {
    const ctx = resolveUserContext(user);
    if (!ctx) return false;

    return (
        ctx.role !== Role.PLATFORM_OWNER &&
        (ctx.roleProfile === RoleProfile.COMPANY_ADMIN ||
            ctx.roleProfile === RoleProfile.SUPER_ADMIN)
    );
}
