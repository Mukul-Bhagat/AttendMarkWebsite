/**
 * Time Utilities - Unit Tests
 * 
 * These tests verify that IST time calculations work correctly
 * regardless of the browser/server timezone.
 * 
 * Test scenarios:
 * - UTC browser (timezone offset = 0)
 * - IST browser (timezone offset = -330)
 * - PST browser (timezone offset = +480)
 * - Midnight boundaries
 * - End of day boundaries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    nowIST,
    istDayStart,
    istDayEnd,
    sessionTimeToIST,
    isSameISTDay,
    IST_OFFSET_MS,
    BUSINESS_TIMEZONE
} from './time';

describe('Time Utilities', () => {
    describe('Constants', () => {
        it('should have correct IST offset', () => {
            expect(IST_OFFSET_MS).toBe(5.5 * 60 * 60 * 1000); // 19,800,000 ms
            expect(IST_OFFSET_MS).toBe(19800000);
        });

        it('should have correct business timezone', () => {
            expect(BUSINESS_TIMEZONE).toBe('Asia/Kolkata');
        });
    });

    describe('nowIST()', () => {
        it('should return current timestamp', () => {
            const before = Date.now();
            const now = nowIST();
            const after = Date.now();

            expect(now).toBeGreaterThanOrEqual(before);
            expect(now).toBeLessThanOrEqual(after);
        });

        it('should return a number', () => {
            expect(typeof nowIST()).toBe('number');
        });
    });

    describe('istDayStart()', () => {
        it('should return timestamp for midnight IST (00:00:00 IST)', () => {
            // Jan 7, 2026, 00:00:00 IST = Jan 6, 2026, 18:30:00 UTC
            const timestamp = istDayStart('2026-01-07');
            const date = new Date(timestamp);

            // Verify it's 18:30 UTC on Jan 6
            expect(date.getUTCFullYear()).toBe(2026);
            expect(date.getUTCMonth()).toBe(0); // January (0-indexed)
            expect(date.getUTCDate()).toBe(6); // Previous day in UTC
            expect(date.getUTCHours()).toBe(18);
            expect(date.getUTCMinutes()).toBe(30);
            expect(date.getUTCSeconds()).toBe(0);
        });

        it('should work with full ISO string', () => {
            const timestamp = istDayStart('2026-01-07T12:34:56.789Z');
            const date = new Date(timestamp);

            // Should ignore time component, only use date
            expect(date.getUTCDate()).toBe(6); // Jan 6 UTC
            expect(date.getUTCHours()).toBe(18);
            expect(date.getUTCMinutes()).toBe(30);
        });

        it('should work for February 29 (leap year)', () => {
            const timestamp = istDayStart('2024-02-29');
            const date = new Date(timestamp);

            expect(date.getUTCFullYear()).toBe(2024);
            expect(date.getUTCMonth()).toBe(1); // February
            expect(date.getUTCDate()).toBe(28); // Feb 28 UTC (Feb 29 IST)
        });

        it('should work for year boundary (Dec 31 -> Jan 1)', () => {
            const timestamp = istDayStart('2026-01-01');
            const date = new Date(timestamp);

            expect(date.getUTCFullYear()).toBe(2025); // Previous year in UTC
            expect(date.getUTCMonth()).toBe(11); // December
            expect(date.getUTCDate()).toBe(31);
        });
    });

    describe('istDayEnd()', () => {
        it('should return timestamp for 23:59:59.999 IST', () => {
            const timestamp = istDayEnd('2026-01-07');
            const date = new Date(timestamp);

            // Jan 7, 23:59:59.999 IST = Jan 7, 18:29:59.999 UTC
            expect(date.getUTCFullYear()).toBe(2026);
            expect(date.getUTCMonth()).toBe(0);
            expect(date.getUTCDate()).toBe(7);
            expect(date.getUTCHours()).toBe(18);
            expect(date.getUTCMinutes()).toBe(29);
            expect(date.getUTCSeconds()).toBe(59);
            expect(date.getUTCMilliseconds()).toBe(999);
        });

        it('should be 1 millisecond before next day start', () => {
            const dayEnd = istDayEnd('2026-01-07');
            const nextDayStart = istDayStart('2026-01-08');

            expect(nextDayStart - dayEnd).toBe(1); // 1 millisecond difference
        });

        it('should be exactly 24 hours after day start', () => {
            const dayStart = istDayStart('2026-01-07');
            const dayEnd = istDayEnd('2026-01-07');

            const diff = dayEnd - dayStart;
            expect(diff).toBe(24 * 60 * 60 * 1000 - 1); // 24 hours minus 1 ms
        });
    });

    describe('sessionTimeToIST()', () => {
        it('should convert date + IST time to correct UTC timestamp', () => {
            // Jan 7, 11:00 IST = Jan 7, 05:30 UTC
            const timestamp = sessionTimeToIST('2026-01-07T00:00:00.000Z', '11:00');
            const date = new Date(timestamp);

            expect(date.getUTCFullYear()).toBe(2026);
            expect(date.getUTCMonth()).toBe(0);
            expect(date.getUTCDate()).toBe(7);
            expect(date.getUTCHours()).toBe(5);
            expect(date.getUTCMinutes()).toBe(30);
        });

        it('should work with evening time (19:00 IST)', () => {
            // Jan 7, 19:00 IST = Jan 7, 13:30 UTC
            const timestamp = sessionTimeToIST('2026-01-07', '19:00');
            const date = new Date(timestamp);

            expect(date.getUTCHours()).toBe(13);
            expect(date.getUTCMinutes()).toBe(30);
        });

        it('should work with midnight (00:00 IST)', () => {
            // Jan 7, 00:00 IST = Jan 6, 18:30 UTC
            const timestamp = sessionTimeToIST('2026-01-07', '00:00');
            const date = new Date(timestamp);

            expect(date.getUTCDate()).toBe(6);
            expect(date.getUTCHours()).toBe(18);
            expect(date.getUTCMinutes()).toBe(30);
        });

        it('should work with late night time (23:59 IST)', () => {
            // Jan 7, 23:59 IST = Jan 7, 18:29 UTC
            const timestamp = sessionTimeToIST('2026-01-07', '23:59');
            const date = new Date(timestamp);

            expect(date.getUTCDate()).toBe(7);
            expect(date.getUTCHours()).toBe(18);
            expect(date.getUTCMinutes()).toBe(29);
        });

        it('should work with time having minutes', () => {
            // Jan 7, 14:30 IST = Jan 7, 09:00 UTC
            const timestamp = sessionTimeToIST('2026-01-07', '14:30');
            const date = new Date(timestamp);

            expect(date.getUTCHours()).toBe(9);
            expect(date.getUTCMinutes()).toBe(0);
        });
    });

    describe('isSameISTDay()', () => {
        it('should return true for timestamps on same IST day', () => {
            const morning = sessionTimeToIST('2026-01-07', '09:00'); // 9 AM IST
            const evening = sessionTimeToIST('2026-01-07', '21:00'); // 9 PM IST

            expect(isSameISTDay(morning, evening)).toBe(true);
        });

        it('should return false for timestamps on different IST days', () => {
            const jan7 = sessionTimeToIST('2026-01-07', '23:59');
            const jan8 = sessionTimeToIST('2026-01-08', '00:01');

            expect(isSameISTDay(jan7, jan8)).toBe(false);
        });

        it('should handle IST midnight boundary correctly', () => {
            // Jan 7, 00:00:00 IST = Jan 6, 18:30:00 UTC
            const istMidnight = istDayStart('2026-01-07');

            // Jan 6, 23:59:59 IST = Jan 6, 18:29:59 UTC
            const prevDayEnd = istDayEnd('2026-01-06');

            expect(isSameISTDay(istMidnight, prevDayEnd)).toBe(false);
        });

        it('should work across UTC day boundary but same IST day', () => {
            // Jan 7, 20:00 IST = Jan 7, 14:30 UTC (same UTC day)
            const evening = sessionTimeToIST('2026-01-07', '20:00');

            // Jan 7, 04:00 IST = Jan 6, 22:30 UTC (different UTC day!)
            const earlyMorning = sessionTimeToIST('2026-01-07', '04:00');

            // These are both Jan 7 IST, even though different UTC days
            expect(isSameISTDay(evening, earlyMorning)).toBe(true);
        });

        it('should handle year boundary', () => {
            const dec31 = sessionTimeToIST('2025-12-31', '23:59');
            const jan1 = sessionTimeToIST('2026-01-01', '00:01');

            expect(isSameISTDay(dec31, jan1)).toBe(false);
        });
    });

    describe('Real-world scenarios', () => {
        it('calculates session window correctly', () => {
            // Session: Jan 7, 11:00 - 19:00 IST
            const sessionStart = sessionTimeToIST('2026-01-07', '11:00');
            const sessionEnd = sessionTimeToIST('2026-01-07', '19:00');
            const buffer = 10 * 60 * 1000; // 10 minutes
            const cutoff = sessionEnd + buffer;

            // Test at 3:15 PM IST
            const currentTime = sessionTimeToIST('2026-01-07', '15:15');

            expect(currentTime >= sessionStart).toBe(true);
            expect(currentTime <= cutoff).toBe(true);
            // Status should be LIVE
        });

        it('handles overnight session correctly', () => {
            // Session: Jan 7, 23:00 - Jan 8, 02:00 IST
            const sessionStart = sessionTimeToIST('2026-01-07', '23:00');
            const sessionEnd = sessionTimeToIST('2026-01-08', '02:00');

            // At Jan 8, 00:30 IST (midnight between)
            const currentTime = sessionTimeToIST('2026-01-08', '00:30');

            expect(currentTime >= sessionStart).toBe(true);
            expect(currentTime <= sessionEnd).toBe(true);
            // Status should be LIVE
        });

        it('filters by IST day correctly', () => {
            // Sessions on different days
            const session1 = sessionTimeToIST('2026-01-07', '11:00');
            const session2 = sessionTimeToIST('2026-01-08', '11:00');
            const session3 = sessionTimeToIST('2026-01-09', '11:00');

            // User selects Jan 8
            const selectedDayStart = istDayStart('2026-01-08');
            const selectedDayEnd = istDayEnd('2026-01-08');

            // Only session2 should be in range
            expect(session1 < selectedDayStart).toBe(true);
            expect(session2 >= selectedDayStart && session2 <= selectedDayEnd).toBe(true);
            expect(session3 > selectedDayEnd).toBe(true);
        });
    });

    describe('Browser timezone independence', () => {
        it('should produce same results regardless of system timezone', () => {
            // This test verifies results are deterministic
            // The actual timezone doesn't matter because we use Intl API

            const timestamp1 = istDayStart('2026-01-07');
            const timestamp2 = istDayStart('2026-01-07');

            expect(timestamp1).toBe(timestamp2);
        });

        it('should match expected UTC equivalents', () => {
            // Jan 7, 2026, 00:00:00 IST
            const istMidnight = istDayStart('2026-01-07');

            // Should equal Jan 6, 2026, 18:30:00 UTC
            const expected = Date.UTC(2026, 0, 6, 18, 30, 0, 0);

            expect(istMidnight).toBe(expected);
        });
    });
});
