/**
 * Session Status Utilities - UTC-BASED WITH IST OFFSET
 * 
 * CRITICAL FIX: All logic operates in UTC
 * IST times are converted to UTC by subtracting 5:30 offset
 * 
 * @version 8.0 - Final UTC-based with proper IST handling
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

// IST is UTC+05:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// ============================================
// UTC TIME UTILITIES
// ============================================

/**
 * Get current time in UTC
 * ALL comparisons happen in UTC
 */
export function nowUTC(): Date {
    return new Date(); // JavaScript Date is always UTC internally
}

/**
 * Convert IST date + time to UTC Date
 * 
 * CRITICAL: This is THE function for session time calculations
 * 
 * @param dateISO UTC date string from backend (e.g., "2026-01-07T00:00:00.000Z" = midnight UTC = 5:30 AM IST)
 * @param timeIST IST time string (e.g., "19:00" means 7 PM in India)
 * @returns UTC Date representing that IST time
 */
export function istTimeToUTC(dateISO: string, timeIST: string): Date {
    // Parse backend date (midnight UTC)
    const baseDate = new Date(dateISO);

    // Get the date components in IST using Intl
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: IST_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(baseDate);
    const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';

    const istYear = parseInt(getValue('year'));
    const istMonth = parseInt(getValue('month')) - 1; // 0-indexed
    const istDay = parseInt(getValue('day'));

    // Parse IST time
    const [hours, minutes] = timeIST.split(':').map(Number);

    // Create full IST datetime in UTC by:
    // 1. Create UTC date with IST date components
    // 2. Set UTC time to (IST time - 5:30)

    let utcHours = hours - 5;
    let utcMinutes = minutes - 30;

    // Handle wraparound
    if (utcMinutes < 0) {
        utcMinutes += 60;
        utcHours -= 1;
    }

    if (utcHours < 0) {
        utcHours += 24;
        // Need to go to previous day
        const result = new Date(Date.UTC(istYear, istMonth, istDay, 0, 0, 0, 0));
        result.setUTCDate(result.getUTCDate() - 1);
        result.setUTCHours(utcHours, utcMinutes, 0, 0);
        return result;
    }

    // Normal case
    return new Date(Date.UTC(istYear, istMonth, istDay, utcHours, utcMinutes, 0, 0));
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get session end time in UTC
 * 
 * CRITICAL: Uses startDate for calculation
 * Converts IST endTime to UTC
 */
export function getSessionEndDateTimeUTC(session: {
    startDate: string | Date;
    endDate?: string | Date;
    startTime?: string;
    endTime?: string;
}): Date {
    const dateISO = typeof session.startDate === 'string'
        ? session.startDate
        : session.startDate.toISOString();

    if (session.endTime?.includes(':')) {
        const endUTC = istTimeToUTC(dateISO, session.endTime);

        // Handle overnight sessions
        if (session.startTime) {
            const startUTC = istTimeToUTC(dateISO, session.startTime);

            if (endUTC < startUTC) {
                // Session ends next day
                endUTC.setUTCDate(endUTC.getUTCDate() + 1);
            }
        }

        return endUTC;
    } else {
        // End of day IST (23:59 IST = 18:29 UTC)
        return istTimeToUTC(dateISO, '23:59');
    }
}

/**
 * Get session start time in UTC
 */
export function getSessionStartDateTimeUTC(session: {
    startDate: string | Date;
    startTime?: string;
}): Date {
    const dateISO = typeof session.startDate === 'string'
        ? session.startDate
        : session.startDate.toISOString();

    if (session.startTime?.includes(':')) {
        return istTimeToUTC(dateISO, session.startTime);
    } else {
        // Start of day IST (00:00 IST = 18:30 UTC previous day)
        return istTimeToUTC(dateISO, '00:00');
    }
}

// ============================================
// MAIN STATUS FUNCTION
// ============================================

/**
 * Calculate session status using pure UTC logic
 * 
 * CANONICAL ALGORITHM:
 * 1. Cancelled: session.isCancelled === true
 * 2. Past: session.isCompleted === true OR nowUTC > (endUTC + buffer)
 * 3. Upcoming: nowUTC < startUTC
 * 4. Live: startUTC <= nowUTC <= (endUTC + buffer)
 * 
 * @param session Session object
 * @param now Current UTC time (defaults to nowUTC())
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
    now: Date = nowUTC()
): SessionStatus {
    // PRIORITY 1: Cancelled sessions
    if (session.isCancelled) return 'cancelled';

    // PRIORITY 2: Completed sessions (backend authority)
    if (session.isCompleted) return 'past';

    // Get UTC times
    const startUTC = getSessionStartDateTimeUTC(session);
    const endUTC = getSessionEndDateTimeUTC(session);
    const cutoffUTC = new Date(endUTC.getTime() + BUFFER_MINUTES * 60 * 1000);

    // UTC comparison
    const nowTime = now.getTime();
    const startTime = startUTC.getTime();
    const cutoffTime = cutoffUTC.getTime();

    // COMPREHENSIVE LOGGING
    console.group('🔍 SESSION CLASSIFICATION TRACE');
    console.log('Session Name:', (session as any).name || 'Unknown');
    console.log('startDate (from backend):', session.startDate);
    console.log('startTime (IST):', session.startTime);
    console.log('endTime (IST):', session.endTime);
    console.log('---');
    console.log('Computed startUTC:', startUTC.toISOString());
    console.log('Computed endUTC:', endUTC.toISOString());
    console.log('Computed cutoffUTC (with buffer):', cutoffUTC.toISOString());
    console.log('Current nowUTC:', now.toISOString());
    console.log('---');
    console.log('Comparison:');
    console.log('  nowUTC <start-15>?', nowTime, '<', startTime, '=', nowTime < startTime);
    console.log('  nowUTC >= start?', nowTime, '>=', startTime, '=', nowTime >= startTime);
    console.log('  nowUTC <= cutoff?', nowTime, '<=', cutoffTime, '=', nowTime <= cutoffTime);
    console.log('---');

    let status: SessionStatus;
    if (nowTime < startTime) {
        status = 'upcoming';
    } else if (nowTime >= startTime && nowTime <= cutoffTime) {
        status = 'live';
    } else {
        status = 'past';
    }

    console.log('📊 FINAL STATUS:', status);
    console.groupEnd();

    return status;
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

export function isSameDay(d1: Date, d2: Date): boolean {
    return (
        d1.getUTCFullYear() === d2.getUTCFullYear() &&
        d1.getUTCMonth() === d2.getUTCMonth() &&
        d1.getUTCDate() === d2.getUTCDate()
    );
}

// ============================================
// EXPORTS
// ============================================

export default {
    getSessionStatus,
    getSessionStartDateTimeUTC,
    getSessionEndDateTimeUTC,
    isSessionLive,
    isSessionPast,
    isSessionUpcoming,
    isSessionCancelled,
    isSameDay,
    nowUTC,
    BUFFER_MINUTES,
    IST_TIMEZONE
};
