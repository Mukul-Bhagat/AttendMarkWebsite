import { appLogger } from '../shared/logger';
/**
 * Session Status Utilities - IST Timestamp Based
 * 
 * Pure business logic for session status calculation.
 * Uses ONLY time.ts utilities - no Date objects in logic.
 * 
 * @see TIME_ARCHITECTURE.md Section 5.2 for logic standard
 */

import {
    nowIST,
    sessionTimeToIST,
    isSameISTDay,
    formatIST,
    istDayStart,
    type ISTTimestamp
} from './time';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type SessionStatus = 'upcoming' | 'live' | 'past' | 'cancelled';

// ============================================
// CONSTANTS
// ============================================

/**
 * Buffer time after session end (in minutes)
 * Allows late attendance marking
 */
export const BUFFER_MINUTES = Number(import.meta.env.VITE_SESSION_BUFFER_MINUTES ?? 10);
const BUFFER_MS = BUFFER_MINUTES * 60 * 1000;

/**
 * IST timezone constant (re-exported for convenience)
 */
export const IST_TIMEZONE = 'Asia/Kolkata';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get session start time as IST timestamp
 * 
 * @param session Session object with startDate and optional startTime
 * @returns IST timestamp when session starts
 */
export function getSessionStartTimeIST(session: {
    startDate: string | Date;
    occurrenceDate?: string;
    startTime?: string;
    frequency?: string;
}): ISTTimestamp {
    // ENFORCEMENT: Recurring sessions MUST use occurrenceDate
    if (import.meta.env.DEV && session.frequency && session.frequency !== 'OneTime' && !session.occurrenceDate) {
        appLogger.error('CRITICAL: Recurring session missing occurrenceDate. Using startDate (Series Start) will cause status bugs.');
        throw new Error('Time Architecture Violation: Recurring session used startDate for status.');
    }

    // Priority: occurrenceDate > startDate
    const dateSource = session.occurrenceDate || session.startDate;

    // Convert to ISO string if Date object
    const dateISO = typeof dateSource === 'string'
        ? dateSource
        : dateSource.toISOString();

    // Use startTime if provided, otherwise default to start of day
    const timeIST = session.startTime || '00:00';

    return sessionTimeToIST(dateISO, timeIST);
}

/**
 * Get session end time as IST timestamp
 * 
 * CRITICAL: Always uses session.startDate (or occurrenceDate), NOT endDate
 * For recurring sessions, endDate = series end, not instance end
 * 
 * @param session Session object
 * @returns IST timestamp when session ends
 */
export function getSessionEndTimeIST(session: {
    startDate: string | Date;
    occurrenceDate?: string;
    endDate?: string | Date;
    startTime?: string;
    endTime?: string;
    frequency?: string;
}): ISTTimestamp {
    // ENFORCEMENT: Recurring sessions MUST use occurrenceDate
    if (import.meta.env.DEV && session.frequency && session.frequency !== 'OneTime' && !session.occurrenceDate) {
        appLogger.error('CRITICAL: Recurring session missing occurrenceDate. Using startDate (Series Start) will cause status bugs.');
        throw new Error('Time Architecture Violation: Recurring session used startDate for status.');
    }

    // Priority: occurrenceDate > startDate
    const dateSource = session.occurrenceDate || session.startDate;

    // Convert to ISO string if Date object
    const dateISO = typeof dateSource === 'string'
        ? dateSource
        : dateSource.toISOString();

    // Use endTime if provided, otherwise default to end of day
    const timeIST = session.endTime || '23:59';

    const endTimestamp = sessionTimeToIST(dateISO, timeIST);

    // Handle overnight sessions (end time before start time)
    if (session.startTime && session.endTime) {
        const startTimestamp = sessionTimeToIST(dateISO, session.startTime);

        if (endTimestamp < startTimestamp) {
            // Session ends next day - add 24 hours
            return endTimestamp + (24 * 60 * 60 * 1000);
        }
    }

    return endTimestamp;
}

// ============================================
// MAIN STATUS FUNCTION
// ============================================

/**
 * Calculate session status using IST timestamps
 * 
 * CANONICAL ALGORITHM:
 * 1. Cancelled: session.isCancelled === true
 * 2. Past: session.isCompleted === true OR now > end + buffer
 * 3. Upcoming: now < start
 * 4. Live: start ≤ now ≤ end + buffer
 * 
 * @param session Session object
 * @param now Optional current timestamp (defaults to nowIST())
 * @returns Session status
 */
export function getSessionStatus(
    session: {
        startDate: string | Date;
        occurrenceDate?: string;
        endDate?: string | Date;
        startTime?: string;
        endTime?: string;
        frequency?: string;
        isCancelled?: boolean;
        isCompleted?: boolean;
    },
    now?: ISTTimestamp
): SessionStatus {
    // PRIORITY 1: Cancelled sessions
    if (session.isCancelled) {
        appLogger.info('📛 Session is cancelled');
        return 'cancelled';
    }

    // PRIORITY 2: Completed sessions (backend authority)
    if (session.isCompleted) {
        appLogger.info('✅ Session marked as completed by backend');
        return 'past';
    }

    // Get current time
    const currentTime = now ?? nowIST();

    // Calculate session times (all in IST timestamps)
    const startIST = getSessionStartTimeIST(session);
    const endIST = getSessionEndTimeIST(session);
    const cutoffIST = endIST + BUFFER_MS;

    // TRACE LOGGING
    console.group('🔍 SESSION STATUS TRACE');
    appLogger.info('Session:', (session as any).name || 'Unknown');
    appLogger.info('---');
    appLogger.info('Input Data:');
    appLogger.info('  startDate:', session.startDate);
    appLogger.info('  startTime:', session.startTime || '(default: 00:00)');
    appLogger.info('  endTime:', session.endTime || '(default: 23:59)');
    appLogger.info('---');
    appLogger.info('Computed IST Timestamps:');
    appLogger.info('  startIST:', startIST, '→', formatIST(startIST, {
        dateStyle: 'medium',
        timeStyle: 'medium'
    }));
    appLogger.info('  endIST:', endIST, '→', formatIST(endIST, {
        dateStyle: 'medium',
        timeStyle: 'medium'
    }));
    appLogger.info('  cutoffIST (end + buffer):', cutoffIST, '→', formatIST(cutoffIST, {
        dateStyle: 'medium',
        timeStyle: 'medium'
    }));
    appLogger.info('  nowIST:', currentTime, '→', formatIST(currentTime, {
        dateStyle: 'medium',
        timeStyle: 'medium'
    }));
    appLogger.info('  buffer:', `${BUFFER_MINUTES} minutes`);
    appLogger.info('---');
    appLogger.info('Comparisons:');
    appLogger.info('  now < start?', currentTime, '<', startIST, '=', currentTime < startIST);
    appLogger.info('  now >= start?', currentTime, '>=', startIST, '=', currentTime >= startIST);
    appLogger.info('  now <= cutoff?', currentTime, '<=', cutoffIST, '=', currentTime <= cutoffIST);
    appLogger.info('  now > cutoff?', currentTime, '>', cutoffIST, '=', currentTime > cutoffIST);
    appLogger.info('---');

    // Determine status
    let status: SessionStatus;

    if (currentTime < startIST) {
        status = 'upcoming';
        appLogger.info('📅 Status: UPCOMING (before start time)');
    } else if (currentTime >= startIST && currentTime <= cutoffIST) {
        status = 'live';

        // RUNTIME ASSERTION: Ensure "Live" status is consistent with Date logic
        if (import.meta.env.DEV) {
            // Verify that we aren't accidentally marking a session as live on the wrong day due to timezone bugs
            // Note: This might trigger for valid multi-day sessions, but for standard daily sessions it's a good guard.
            // We check only if start and end are on the same day.
            const sTime = formatIST(startIST);
            const eTime = formatIST(endIST);
            if (sTime.split(' ')[0] === eTime.split(' ')[0]) { // Same day session
                if (!isSameISTDay(currentTime, startIST)) {
                    appLogger.error('CRITICAL: Session is LIVE but current IST day does not match Session Start Day. Check Timezone Config.');
                    throw new Error('Time Architecture Violation: Live status day mismatch');
                }
            }
        }

        appLogger.info('🟢 Status: LIVE (within session window + buffer)');
    } else {
        status = 'past';
        appLogger.info('⏹️ Status: PAST (after cutoff time)');
    }

    console.groupEnd();

    return status;
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Check if session is currently live
 */
export function isSessionLive(
    session: Parameters<typeof getSessionStatus>[0],
    now?: ISTTimestamp
): boolean {
    return getSessionStatus(session, now) === 'live';
}

/**
 * Check if session is past
 */
export function isSessionPast(
    session: Parameters<typeof getSessionStatus>[0],
    now?: ISTTimestamp
): boolean {
    return getSessionStatus(session, now) === 'past';
}

/**
 * Check if session is upcoming
 */
export function isSessionUpcoming(
    session: Parameters<typeof getSessionStatus>[0],
    now?: ISTTimestamp
): boolean {
    return getSessionStatus(session, now) === 'upcoming';
}

/**
 * Check if session is cancelled
 */
export function isSessionCancelled(
    session: Parameters<typeof getSessionStatus>[0],
    now?: ISTTimestamp
): boolean {
    return getSessionStatus(session, now) === 'cancelled';
}

/**
 * Check if two dates are the same IST day
 * 
 * Accepts Date objects, ISO strings, or numeric timestamps
 */
export function isSameDay(d1: Date | string | number, d2: Date | string | number): boolean {
    const t1 = typeof d1 === 'number' ? d1 : (typeof d1 === 'string' ? istDayStart(d1) : istDayStart(d1.toISOString()));
    const t2 = typeof d2 === 'number' ? d2 : (typeof d2 === 'string' ? istDayStart(d2) : istDayStart(d2.toISOString()));

    return isSameISTDay(t1, t2);
}

// Re-export nowIST for convenience
export { nowIST } from './time';

// ============================================
// EXPORTS
// ============================================

export default {
    getSessionStatus,
    getSessionStartTimeIST,
    getSessionEndTimeIST,
    isSessionLive,
    isSessionPast,
    isSessionUpcoming,
    isSessionCancelled,
    isSameDay,
    nowIST,
    BUFFER_MINUTES,
    IST_TIMEZONE
};
