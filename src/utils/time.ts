/**
 * IST Time Utilities - CANONICAL IMPLEMENTATION
 * 
 * This is the ONLY module allowed to handle time operations.
 * All business logic MUST use these functions.
 * 
 * Core Principle:
 * - Returns: Numeric timestamps (milliseconds since epoch)
 * - Input: ISO date strings, IST time strings
 * - Timezone: All calculations in IST (Asia/Kolkata)
 * 
 * @see TIME_ARCHITECTURE.md Section 5 & 7
 */

// ============================================
// CONSTANTS
// ============================================

/**
 * Business timezone - the ONLY timezone used in this application
 */
export const BUSINESS_TIMEZONE = 'Asia/Kolkata';

/**
 * IST offset from UTC in milliseconds
 * IST = UTC + 5 hours 30 minutes
 */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19,800,000 ms

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * IST Timestamp - Standard numeric timestamp (ms since epoch)
 * 
 * Note: This is NOT a special "IST-based epoch" - it's a standard UTC timestamp.
 * The "IST" designation means this timestamp represents a specific moment
 * that was calculated respecting IST boundaries.
 */
export type ISTTimestamp = number;

// ============================================
// CORE UTILITIES
// ============================================

/**
 * Get current time as standard timestamp
 * 
 * @returns Current UTC timestamp (ms since epoch)
 */
export function nowIST(): ISTTimestamp {
    return Date.now();
}

/**
 * Get UTC timestamp for midnight IST on a given date
 * 
 * Example: istDayStart("2026-01-07") returns UTC timestamp for:
 *   Jan 7, 2026, 00:00:00 IST
 *   = Jan 6, 2026, 18:30:00 UTC
 * 
 * @param isoDate ISO date string (e.g., "2026-01-07" or "2026-01-07T00:00:00.000Z")
 * @returns UTC timestamp representing midnight IST on that date
 */
export function istDayStart(isoDate: string): ISTTimestamp {
    // Extract date components (year, month, day)
    const dateOnly = isoDate.split('T')[0];
    const [year, month, day] = dateOnly.split('-').map(Number);





    // Now we know what UTC midnight looks like as an IST date
    // We want the OPPOSITE: what IST midnight looks like as UTC
    // IST midnight = UTC - 5.5 hours

    // The input date components represent an IST date
    // Create UTC timestamp for that IST date at 00:00 IST
    // 00:00 IST = 18:30 previous day UTC

    const istMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    return istMidnight - IST_OFFSET_MS;
}

/**
 * Get UTC timestamp for end of day IST (23:59:59.999)
 * 
 * @param isoDate ISO date string
 * @returns UTC timestamp representing 23:59:59.999 IST on that date
 */
export function istDayEnd(isoDate: string): ISTTimestamp {
    const start = istDayStart(isoDate);
    // Add 1 day minus 1 millisecond
    return start + (24 * 60 * 60 * 1000) - 1;
}

/**
 * Convert backend ISO date + IST time to UTC timestamp
 * 
 * Example: sessionTimeToIST("2026-01-07T00:00:00.000Z", "11:00")
 *   Backend date represents: Jan 7 (as a calendar date, ignore the time component)
 *   IST time: 11:00 IST
 *   Result: UTC timestamp for Jan 7, 2026, 11:00:00 IST
 *           = Jan 7, 2026, 05:30:00 UTC
 * 
 * @param isoDate Backend ISO date string (time component ignored, only date matters)
 * @param timeIST IST time string in "HH:mm" format (e.g., "11:00", "19:30")
 * @returns UTC timestamp for that IST date + time
 */
export function sessionTimeToIST(isoDate: string, timeIST: string): ISTTimestamp {
    // Get midnight IST for this date
    const dayStart = istDayStart(isoDate);

    // Parse time components
    const [hours, minutes] = timeIST.split(':').map(Number);

    // Add time offset to midnight
    const timeOffsetMs = (hours * 60 + minutes) * 60 * 1000;

    return dayStart + timeOffsetMs;
}

/**
 * Check if two timestamps occur on the same IST calendar day
 * 
 * @param timestampA First UTC timestamp
 * @param timestampB Second UTC timestamp
 * @returns true if both timestamps are on the same IST day
 */
export function isSameISTDay(timestampA: ISTTimestamp, timestampB: ISTTimestamp): boolean {
    // Convert both timestamps to IST and check if they're on the same calendar day
    const dateA = new Date(timestampA);
    const dateB = new Date(timestampB);

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: BUSINESS_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const partsA = formatter.formatToParts(dateA);
    const partsB = formatter.formatToParts(dateB);

    const getDate = (parts: Intl.DateTimeFormatPart[]) => {
        const year = parts.find(p => p.type === 'year')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;
        return `${year}-${month}-${day}`;
    };

    return getDate(partsA) === getDate(partsB);
}

/**
 * Convert any date input to IST Date String (YYYY-MM-DD)
 * 
 * @param date Date object, ISO string, or timestamp
 * @returns YYYY-MM-DD in IST
 */
export function toISTDateString(date: Date | string | number): string {
    const timestamp = typeof date === 'number' ? date : new Date(date).getTime();

    // Use Intl to format in IST
    const parts = new Intl.DateTimeFormat('en-IN', {
        timeZone: BUSINESS_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(timestamp);

    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;

    return `${year}-${month}-${day}`;
}

// ============================================
// DEPRECATED FUNCTIONS
// ============================================

/**
 * @deprecated DO NOT USE - This function had a critical bug
 * Use istDayStart() instead
 * 
 * This function is kept only to prevent breaking existing imports.
 * It will throw an error if called.
 * 
 * @see TIME_ARCHITECTURE.md Appendix A for bug details
 */
export function istDateFromYMD(year: number, month: number, day: number): never {
    throw new Error(
        'istDateFromYMD() is DEPRECATED and contained a critical bug.\n' +
        'Use istDayStart() instead:\n' +
        `  istDayStart("${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}")\n` +
        'See TIME_ARCHITECTURE.md for migration guide.'
    );
}

/**
 * @deprecated DO NOT USE - Exposes Date objects
 * All utilities now return numeric timestamps only
 */
export function istToDate(istTimestamp: number): never {
    throw new Error(
        'istToDate() is DEPRECATED.\n' +
        'Use numeric timestamps directly for all logic.\n' +
        'For display, use Intl.DateTimeFormat with timeZone: "Asia/Kolkata".\n' +
        'See TIME_ARCHITECTURE.md Section 5.3'
    );
}

/**
 * @deprecated DO NOT USE - Returns Date components
 * Work with timestamps directly
 */
export function getISTDateComponents(istTimestamp: number): never {
    throw new Error(
        'getISTDateComponents() is DEPRECATED.\n' +
        'Work with timestamps directly in business logic.\n' +
        'For display formatting, use Intl.DateTimeFormat.\n' +
        'See TIME_ARCHITECTURE.md Section 5.3'
    );
}

// ============================================
// DISPLAY HELPERS (Optional utilities)
// ============================================

/**
 * Format timestamp for display in IST
 * 
 * This is a DISPLAY HELPER - do NOT use in business logic
 * 
 * @param timestamp UTC timestamp
 * @param options Intl.DateTimeFormat options
 * @returns Formatted string
 */
export function formatIST(
    timestamp: ISTTimestamp,
    options?: Intl.DateTimeFormatOptions
): string {
    return new Intl.DateTimeFormat('en-IN', {
        timeZone: BUSINESS_TIMEZONE,
        ...options
    }).format(timestamp);
}

/**
 * Debug helper: Log IST time details
 * 
 * Use this to inspect timestamps during development
 */
export function debugISTTime(label: string, timestamp: ISTTimestamp): void {
    const formatted = formatIST(timestamp, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    console.log(`[${label}]`, {
        timestamp,
        formattedIST: formatted,
        iso: new Date(timestamp).toISOString()
    });
}

// ============================================
// EXPORTS
// ============================================

export default {
    // Constants
    BUSINESS_TIMEZONE,
    IST_OFFSET_MS,

    // Core utilities
    nowIST,
    istDayStart,
    istDayEnd,
    sessionTimeToIST,
    isSameISTDay,
    toISTDateString,

    // Display helpers
    formatIST,
    debugISTTime
};
