/**
 * Global Time Utilities - IST-Based System
 * 
 * BUSINESS RULE: This application operates in Indian Standard Time (Asia/Kolkata)
 * 
 * - All "today", "date selection", and "calendar day" logic happens in IST
 * - Day boundaries are 00:00 AM - 11:59 PM IST
 * - UTC is used internally for storage but never for business logic
 * 
 * @version 1.0 - Global IST enforcement
 */

// ============================================
// CONSTANTS
// ============================================

/**
 * Business timezone for the entire application
 */
export const BUSINESS_TIMEZONE = 'Asia/Kolkata';

/**
 * IST offset from UTC in milliseconds
 * IST = UTC + 5 hours 30 minutes
 */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// ============================================
// CORE IST TIME FUNCTIONS
// ============================================

/**
 * Get current time in IST as timestamp (milliseconds)
 * 
 * This is the ONLY way to get "now" in the system
 * 
 * @returns IST timestamp
 */
export function nowIST(): number {
    return Date.now() + IST_OFFSET_MS;
}

/**
 * Get IST midnight (start of day) for a given date
 * 
 * @param dateISO ISO date string (e.g., "2026-01-07T00:00:00.000Z" or "2026-01-07")
 * @returns IST timestamp at 00:00:00 on that day
 */
export function istDayStart(dateISO: string): number {
    // Remove time component if present
    const dateOnly = dateISO.split('T')[0];
    const [year, month, day] = dateOnly.split('-').map(Number);

    // Create UTC midnight for that calendar date
    const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

    // Convert to IST midnight
    // NOTE: This is the IST timestamp for 00:00:00 IST on that day
    // Which is actually 18:30:00 UTC on the PREVIOUS day
    return utcMidnight + IST_OFFSET_MS - 24 * 60 * 60 * 1000 + IST_OFFSET_MS;
}

/**
 * Get IST end of day (23:59:59.999) for a given date
 * 
 * @param dateISO ISO date string
 * @returns IST timestamp at 23:59:59.999 on that day
 */
export function istDayEnd(dateISO: string): number {
    const start = istDayStart(dateISO);
    return start + 24 * 60 * 60 * 1000 - 1;
}

/**
 * Create IST timestamp from year, month, day
 * 
 * @param year Year (e.g., 2026)
 * @param month Month (1-12, NOT 0-11)
 * @param day Day (1-31)
 * @returns IST timestamp at midnight on that date
 */
export function istDateFromYMD(year: number, month: number, day: number): number {
    const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    return utcMidnight;
}

/**
 * Convert IST timestamp to Date object for display
 * 
 * @param istTimestamp IST timestamp
 * @returns Date object (in browser's local timezone, but represents IST time)
 */
export function istToDate(istTimestamp: number): Date {
    return new Date(istTimestamp - IST_OFFSET_MS);
}

/**
 * Get date components (year, month, day) from IST timestamp
 * 
 * @param istTimestamp IST timestamp
 * @returns Object with year, month (1-12), day
 */
export function getISTDateComponents(istTimestamp: number): {
    year: number;
    month: number;
    day: number;
} {
    const date = istToDate(istTimestamp);
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate()
    };
}

/**
 * Check if two IST timestamps are on the same IST day
 * 
 * @param ist1 First IST timestamp
 * @param ist2 Second IST timestamp
 * @returns true if same IST day
 */
export function isSameISTDay(ist1: number, ist2: number): boolean {
    const d1 = getISTDateComponents(ist1);
    const d2 = getISTDateComponents(ist2);

    return d1.year === d2.year && d1.month === d2.month && d1.day === d2.day;
}

/**
 * Format IST timestamp for display
 * 
 * @param istTimestamp IST timestamp
 * @param options Intl.DateTimeFormat options
 * @returns Formatted string
 */
export function formatIST(
    istTimestamp: number,
    options?: Intl.DateTimeFormatOptions
): string {
    const date = istToDate(istTimestamp);
    return new Intl.DateTimeFormat('en-IN', {
        timeZone: BUSINESS_TIMEZONE,
        ...options
    }).format(date);
}

// ============================================
// SESSION TIME FUNCTIONS
// ============================================

/**
 * Convert backend session date + IST time to IST timestamp
 * 
 * @param dateISO Backend date (e.g., "2026-01-07T00:00:00.000Z")
 * @param timeIST IST time string (e.g., "19:00")
 * @returns IST timestamp
 */
export function sessionTimeToIST(dateISO: string, timeIST: string): number {
    // Extract date components from the ISO string
    const dateOnly = dateISO.split('T')[0];
    const [year, month, day] = dateOnly.split('-').map(Number);

    // Parse IST time
    const [hours, minutes] = timeIST.split(':').map(Number);

    // Create IST timestamp
    // Step 1: Get midnight on that calendar date in UTC
    const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

    // Step 2: Add hours and minutes
    const timeOffset = (hours * 60 + minutes) * 60 * 1000;

    // Step 3: This is the IST timestamp (no conversion needed - we're working in IST time)
    return utcMidnight + timeOffset;
}

// ============================================
// DEBUGGING UTILITIES
// ============================================

/**
 * Debug helper: Log IST time details
 */
export function debugISTTime(label: string, istTimestamp: number): void {
    const components = getISTDateComponents(istTimestamp);
    const formatted = formatIST(istTimestamp, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    console.log(`[${label}]`, {
        timestamp: istTimestamp,
        formatted,
        components,
        iso: istToDate(istTimestamp).toISOString()
    });
}

// ============================================
// EXPORTS
// ============================================

export default {
    BUSINESS_TIMEZONE,
    IST_OFFSET_MS,
    nowIST,
    istDayStart,
    istDayEnd,
    istDateFromYMD,
    istToDate,
    getISTDateComponents,
    isSameISTDay,
    formatIST,
    sessionTimeToIST,
    debugISTTime
};
