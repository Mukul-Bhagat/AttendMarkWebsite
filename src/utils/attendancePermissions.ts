/**
 * Attendance Permission Utilities
 * 
 * Centralized permission checking for attendance-related operations
 */

export type AllowedRole = 'PLATFORM_OWNER' | 'SuperAdmin' | 'CompanyAdmin' | 'Manager';
export type AdminRole = 'PLATFORM_OWNER' | 'SuperAdmin' | 'CompanyAdmin';

/**
 * Check if a role can view attendance
 */
export function canViewAttendance(role: string): boolean {
    const allowedRoles: AllowedRole[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin', 'Manager'];
    return allowedRoles.includes(role as AllowedRole);
}

/**
 * Check if a role can edit attendance
 */
export function canEditAttendance(role: string): boolean {
    const allowedRoles: AllowedRole[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin', 'Manager'];
    return allowedRoles.includes(role as AllowedRole);
}

/**
 * Check if a role can delete attendance records
 */
export function canDeleteAttendance(role: string): boolean {
    const allowedRoles: AdminRole[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin'];
    return allowedRoles.includes(role as AdminRole);
}

/**
 * Check if a role can manually mark attendance
 */
export function canManuallyMarkAttendance(role: string): boolean {
    const allowedRoles: AllowedRole[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin', 'Manager'];
    return allowedRoles.includes(role as AllowedRole);
}

/**
 * Check if a role can view attendance reports
 */
export function canViewAttendanceReports(role: string): boolean {
    const allowedRoles: AllowedRole[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin', 'Manager'];
    return allowedRoles.includes(role as AllowedRole);
}

/**
 * Check if a role can export attendance data
 */
export function canExportAttendance(role: string): boolean {
    const allowedRoles: AllowedRole[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin', 'Manager'];
    return allowedRoles.includes(role as AllowedRole);
}

/**
 * Check if a role can manage attendance settings
 */
export function canManageAttendanceSettings(role: string): boolean {
    const allowedRoles: AdminRole[] = ['PLATFORM_OWNER', 'SuperAdmin', 'CompanyAdmin'];
    return allowedRoles.includes(role as AdminRole);
}
