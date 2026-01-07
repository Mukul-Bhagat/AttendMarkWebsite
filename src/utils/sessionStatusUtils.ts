/**
 * Session Status Utilities - CANONICAL DATE: startDate
 * 
 * SYSTEM RULE: Use session.startDate for ALL logic
 * - UI Display: startDate
 * - Status Calculation: startDate + startTime/endTime
 * - Filtering: startDate
 * - Sorting: startDate
 * 
 * endDate is ONLY for recurring session END (not individual occurrence)
 * 
 * @version 7.0 - Canonical startDate enforcement
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export type SessionStatus = 'upcoming' | 'live' | 'past' | 'cancelled';

// ============================================
// CONSTANTS
// ============================================

export const BUFFER_MINUTES =
    Number(import.meta.env.VITE_SESSION_BUFFER_MINUTES ?? 10);

export const IST_TIMEZONE = 'Asia/Kolkata';

// ============================================
// IST TIME UTILITIES (BROWSER-INDEPENDENT)
// ============================================

/**
 * Get current time in IST (browser-independent)
 * 
 * Uses Intl.DateTimeFormat for timezone-safe conversion
 * 
 * @returns Current IST time
 */
export function nowIST(): Date {
    const now = new Date();

    // Get IST time components using Intl API
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: IST_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';

    const year = parseInt(getValue('year'));
    const month = parseInt(getValue('month')) - 1;
    const day = parseInt(getValue('day'));
    const hour = parseInt(getValue('hour'));
    const minute = parseInt(getValue('minute'));
    const second = parseInt(getValue('second'));

    return new Date(year, month, day, hour, minute, second);
}

/**
 * Build IST date from UTC date string and IST time string
 * 
 * CRITICAL: This is THE function for constructing session times
 * All session start/end times MUST use this
 * 
 * @param dateISO UTC date string (e.g., "2026-01-07T00:00:00.000Z")
 * @param time IST time string (e.g., "19:00")
 * @returns Date object representing IST time (browser-independent)
 */
export function buildISTDate(dateISO: string, time: string): Date {
    // Parse the UTC date and get its IST representation
    const utcDate = new Date(dateISO);

    // Get the IST date components
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: IST_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(utcDate);
    const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';

    const year = parseInt(getValue('year'));
    const month = parseInt(getValue('month')) - 1;
    const day = parseInt(getValue('day'));

    // Parse time
    const [hours, minutes] = time.split(':').map(Number);

    // Build Date in browser's local representation
    return new Date(year, month, day, hours, minutes, 0, 0);
}

// ============================================
// HELPER FUNCTIONS (CANONICAL: startDate ONLY)
// ============================================

/**
 * Get session end time in IST
 * 
 * CRITICAL: Uses startDate for calculation (NOT endDate!)
 * endDate is for recurring session series end, not individual occurrence
 * 
 * @param session Session object
 * @returns IST Date when session ends
 */
export function getSessionEndDateTimeIST(session: {
    startDate: string | Date;
    endDate?: string | Date;
    startTime?: string;
    endTime?: string;
}): Date {
    // CANONICAL: Always use startDate for status calculation
    const dateValue = session.startDate;
    const dateISO = typeof dateValue === 'string' ? dateValue : dateValue.toISOString();

    if (session.endTime?.includes(':')) {
        // Use buildISTDate with startDate (NOT endDate)
        const endDateIST = buildISTDate(dateISO, session.endTime);

        // Handle overnight sessions (endTime before startTime)
        if (session.startTime) {
            const startDateIST = buildISTDate(dateISO, session.startTime);

            if (endDateIST < startDateIST) {
                // Session ends next day
                endDateIST.setDate(endDateIST.getDate() + 1);
            }
        }

        return endDateIST;
    } else {
        // End of day in IST (23:59:59)
        return buildISTDate(dateISO, '23:59');
    }
}

/**
 * Get session start time in IST
 * 
 * CRITICAL: Uses startDate (canonical field)
 * 
 * @param session Session object
 * @returns IST Date when session starts
 */
export function getSessionStartDateTimeIST(session: {
    startDate: string | Date;
    startTime?: string;
}): Date {
    const dateISO = typeof session.startDate === 'string'
        ? session.startDate
        : session.startDate.toISOString();

    if (session.startTime?.includes(':')) {
        return buildISTDate(dateISO, session.startTime);
    } else {
        // Start of day in IST (00:00:00)
        return buildISTDate(dateISO, '00:00');
    }
}

// ============================================
// MAIN STATUS FUNCTION (IST-BASED)
// ============================================

/**
 * Calculate session status using IST logic
 * 
 * CANONICAL ALGORITHM (startDate-BASED):
 * 1. Cancelled: session.isCancelled === true
 * 2. Past: session.isCompleted === true OR nowIST > (endIST + buffer)
 * 3. Upcoming: nowIST < startIST
 * 4. Live: startIST <= nowIST <= (endIST + buffer)
 * 
 * CRITICAL: All times derived from startDate (not endDate)
 * 
 * @param session Session object
 * @param now Current IST time (defaults to nowIST())
 * @returns Session status
 */
export function getSessionStatus(
    session: {
        startDate: string | Date;
        endDate?: string | Date;
        startTime?: string;
        endTime?: string;
        isCancelled?: boolean;
        isCompleted?: boolean;
    },
    now: Date = nowIST()
): SessionStatus {
    // PRIORITY 1: Cancelled sessions
    if (session.isCancelled) return 'cancelled';

    // PRIORITY 2: Completed sessions (backend authority)
    if (session.isCompleted) return 'past';

    // Get IST times using startDate (CANONICAL)
    const startIST = getSessionStartDateTimeIST(session);
    const endIST = getSessionEndDateTimeIST(session);
    const cutoffIST = new Date(endIST.getTime() + BUFFER_MINUTES * 60 * 1000);

    // Log for verification (development only)
    if (process.env.NODE_ENV === 'development') {
        console.log('🔍 IST STATUS CALCULATION (startDate=' + session.startDate + '):', {
            nowIST: now.toString(),
            startIST: startIST.toString(),
            endIST: endIST.toString(),
            cutoffIST: cutoffIST.toString(),
            comparison_live: now <= cutoffIST
        });
    }

    // Pure IST comparison
    const nowTime = now.getTime();
    const startTime = startIST.getTime();
    const cutoffTime = cutoffIST.getTime();

    if (nowTime < startTime) return 'upcoming';
    if (nowTime >= startTime && nowTime <= cutoffTime) return 'live';
    return 'past';
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

export function isSessionLive(
    session: Parameters<typeof getSessionStatus>[0],
    now?: Date
): boolean {
    return getSessionStatus(session, now) === 'live';
}

export function isSessionPast(
    session: Parameters<typeof getSessionStatus>[0],
    now?: Date
): boolean {
    return getSessionStatus(session, now) === 'past';
}

export function isSessionUpcoming(
    session: Parameters<typeof getSessionStatus>[0],
    now?: Date
): boolean {
    return getSessionStatus(session, now) === 'upcoming';
}

export function isSessionCancelled(
    session: Parameters<typeof getSessionStatus>[0],
    now?: Date
): boolean {
    return getSessionStatus(session, now) === 'cancelled';
}

/**
 * Check if two dates are the same day
 * CRITICAL: Compares date components only (ignores time)
 */
export function isSameDay(d1: Date, d2: Date): boolean {
    return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
    );
}

// ============================================
// EXPORTS
// ============================================

export default {
    getSessionStatus,
    getSessionStartDateTimeIST,
    getSessionEndDateTimeIST,
    isSessionLive,
    isSessionPast,
    isSessionUpcoming,
    isSessionCancelled,
    isSameDay,
    nowIST,
    buildISTDate,
    BUFFER_MINUTES,
    IST_TIMEZONE
};
