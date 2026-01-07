/**
 * Session Status Utilities - IST-Based
 * 
 * Uses the global IST time system for all calculations
 * 
 * @version 9.0 - IST timestamp-based
 */

import {
    nowIST,
    sessionTimeToIST,
    IST_OFFSET_MS,
    debugISTTime,
    isSameISTDay
} from './time';

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
// IST-BASED SESSION STATUS
// ============================================

/**
 * Get session start time as IST timestamp
 */
export function getSessionStartTimeIST(session: {
    startDate: string | Date;
    startTime?: string;
}): number {
    const dateISO = typeof session.startDate === 'string'
        ? session.startDate
        : session.startDate.toISOString();

    if (session.startTime?.includes(':')) {
        return sessionTimeToIST(dateISO, session.startTime);
    } else {
        // Start of day (00:00 IST)
        return sessionTimeToIST(dateISO, '00:00');
    }
}

/**
 * Get session end time as IST timestamp
 */
export function getSessionEndTimeIST(session: {
    startDate: string | Date;
    endDate?: string | Date;
    startTime?: string;
    endTime?: string;
}): number {
    const dateISO = typeof session.startDate === 'string'
        ? session.startDate
        : session.startDate.toISOString();

    if (session.endTime?.includes(':')) {
        const endIST = sessionTimeToIST(dateISO, session.endTime);

        // Handle overnight sessions
        if (session.startTime) {
            const startIST = sessionTimeToIST(dateISO, session.startTime);

            if (endIST < startIST) {
                // Session ends next day
                return endIST + 24 * 60 * 60 * 1000;
            }
        }

        return endIST;
    } else {
        // End of day (23:59 IST)
        return sessionTimeToIST(dateISO, '23:59');
    }
}

/**
 * Calculate session status using IST timestamps
 * 
 * CANONICAL ALGORITHM (IST-BASED):
 * 1. Cancelled: session.isCancelled === true
 * 2. Past: session.isCompleted === true OR nowIST > (endIST + buffer)
 * 3. Upcoming: nowIST < startIST
 * 4. Live: startIST <= nowIST <= (endIST + buffer)
 * 
 * @param session Session object
 * @param now Current IST timestamp (defaults to nowIST())
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
    now?: number
): SessionStatus {
    // PRIORITY 1: Cancelled sessions
    if (session.isCancelled) return 'cancelled';

    // PRIORITY 2: Completed sessions (backend authority)
    if (session.isCompleted) return 'past';

    // Get IST timestamps
    const startIST = getSessionStartTimeIST(session);
    const endIST = getSessionEndTimeIST(session);
    const bufferMS = BUFFER_MINUTES * 60 * 1000;
    const cutoffIST = endIST + bufferMS;
    const currentIST = now ?? nowIST();

    // COMPREHENSIVE LOGGING
    console.group('🔍 SESSION CLASSIFICATION TRACE (IST-BASED)');
    console.log('Session Name:', (session as any).name || 'Unknown');
    console.log('startDate (from backend):', session.startDate);
    console.log('startTime (IST):', session.startTime);
    console.log('endTime (IST):', session.endTime);
    console.log('---');
    debugISTTime('Computed startIST', startIST);
    debugISTTime('Computed endIST', endIST);
    debugISTTime('Computed cutoffIST (with buffer)', cutoffIST);
    debugISTTime('Current nowIST', currentIST);
    console.log('---');
    console.log('Comparison:');
    console.log('  nowIST < start?', currentIST, '<', startIST, '=', currentIST < startIST);
    console.log('  nowIST >= start?', currentIST, '>=', startIST, '=', currentIST >= startIST);
    console.log('  nowIST <= cutoff?', currentIST, '<=', cutoffIST, '=', currentIST <= cutoffIST);
    console.log('---');

    let status: SessionStatus;
    if (currentIST < startIST) {
        status = 'upcoming';
    } else if (currentIST >= startIST && currentIST <= cutoffIST) {
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
    now?: number
): boolean {
    return getSessionStatus(session, now) === 'live';
}

export function isSessionPast(
    session: Parameters<typeof getSessionStatus>[0],
    now?: number
): boolean {
    return getSessionStatus(session, now) === 'past';
}

export function isSessionUpcoming(
    session: Parameters<typeof getSessionStatus>[0],
    now?: number
): boolean {
    return getSessionStatus(session, now) === 'upcoming';
}

export function isSessionCancelled(
    session: Parameters<typeof getSessionStatus>[0],
    now?: number
): boolean {
    return getSessionStatus(session, now) === 'cancelled';
}

/**
 * Check if two dates are the same day in IST
 * 
 * @param d1 Date object or ISO string
 * @param d2 Date object or ISO string
 * @returns true if same IST day
 */
export function isSameDay(d1: Date | string, d2: Date | string): boolean {
    const t1 = typeof d1 === 'string' ? new Date(d1).getTime() : d1.getTime();
    const t2 = typeof d2 === 'string' ? new Date(d2).getTime() : d2.getTime();

    // Convert to IST timestamps
    const ist1 = t1 + IST_OFFSET_MS;
    const ist2 = t2 + IST_OFFSET_MS;

    return isSameISTDay(ist1, ist2);
}

// Re-export for convenience
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
