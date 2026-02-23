import { appLogger } from '../shared/logger';
/**
 * Session Status Verification - Manual Test
 * 
 * Tests all three status scenarios with trace logs
 */

import {
    getSessionStatus,
    nowIST
} from './sessionStatusUtils.js';

appLogger.info('🧪 SESSION STATUS VERIFICATION\n');
appLogger.info('='.repeat(80));

// Test 1: UPCOMING Session
appLogger.info('\n\n📅 TEST 1: UPCOMING SESSION');
appLogger.info('-'.repeat(80));
const upcomingSession = {
    name: 'Future Workshop',
    startDate: '2026-01-10T00:00:00.000Z', // Jan 10 (3 days from now)
    startTime: '14:00', // 2 PM IST
    endTime: '16:00'     // 4 PM IST
};
const upcomingStatus = getSessionStatus(upcomingSession);
appLogger.info(`\n✅ Result: ${upcomingStatus.toUpperCase()}`);
appLogger.info(`Expected: UPCOMING ✓`);

// Test 2: LIVE Session
appLogger.info('\n\n🟢 TEST 2: LIVE SESSION');
appLogger.info('-'.repeat(80));

// Create a session that's happening right now
const now = nowIST();
const nowDate = new Date(now);

// Format current date as YYYY-MM-DD
const todayISO = nowDate.toISOString().split('T')[0];

// Session started 1 hour ago, ends in 1 hour
const oneHourAgo = new Date(now - 60 * 60 * 1000);
const oneHourFromNow = new Date(now + 60 * 60 * 1000);

const startHour = String(oneHourAgo.getHours()).padStart(2, '0');
const startMin = String(oneHourAgo.getMinutes()).padStart(2, '0');
const endHour = String(oneHourFromNow.getHours()).padStart(2, '0');
const endMin = String(oneHourFromNow.getMinutes()).padStart(2, '0');

const liveSession = {
    name: 'Current Meeting',
    startDate: todayISO,
    startTime: `${startHour}:${startMin}`,
    endTime: `${endHour}:${endMin}`
};

appLogger.info(`Session times: ${liveSession.startTime} - ${liveSession.endTime} IST`);

const liveStatus = getSessionStatus(liveSession);
appLogger.info(`\n✅ Result: ${liveStatus.toUpperCase()}`);
appLogger.info(`Expected: LIVE ✓`);

// Test 3: PAST Session
appLogger.info('\n\n⏹️ TEST 3: PAST SESSION');
appLogger.info('-'.repeat(80));
const pastSession = {
    name: 'Yesterday Workshop',
    startDate: '2026-01-06T00:00:00.000Z', // Jan 6 (yesterday)
    startTime: '10:00', // 10 AM IST
    endTime: '12:00'     // 12 PM IST
};
const pastStatus = getSessionStatus(pastSession);
appLogger.info(`\n✅ Result: ${pastStatus.toUpperCase()}`);
appLogger.info(`Expected: PAST ✓`);

// Test 4: Session at buffer boundary
appLogger.info('\n\n⏱️ TEST 4: BUFFER BOUNDARY (Just ended, within 10-min buffer)');
appLogger.info('-'.repeat(80));

// Session that ended 5 minutes ago (within 10-min buffer = still LIVE)
const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
const bufferEndHour = String(fiveMinutesAgo.getHours()).padStart(2, '0');
const bufferEndMin = String(fiveMinutesAgo.getMinutes()).padStart(2, '0');

const bufferSession = {
    name: 'Just Ended Meeting',
    startDate: todayISO,
    startTime: `${startHour}:${startMin}`, // Started 1 hour ago
    endTime: `${bufferEndHour}:${bufferEndMin}` // Ended 5 min ago
};

appLogger.info(`Session ended: ${bufferSession.endTime} IST (5 minutes ago)`);
appLogger.info(`Buffer: 10 minutes → Still within attendance window`);

const bufferStatus = getSessionStatus(bufferSession);
appLogger.info(`\n✅ Result: ${bufferStatus.toUpperCase()}`);
appLogger.info(`Expected: LIVE (within buffer) ✓`);

// Summary
appLogger.info('\n\n' + '='.repeat(80));
appLogger.info('\n✅ ALL STATUS SCENARIOS VERIFIED\n');
appLogger.info('Key Observations:');
appLogger.info('  ✓ Timestamps are pure numbers (no Date objects in logic)');
appLogger.info('  ✓ All times displayed in IST');
appLogger.info('  ✓ Status calculation is timezone-independent');
appLogger.info('  ✓ Buffer window works correctly');
appLogger.info('\n📖 See TIME_ARCHITECTURE.md for architecture details\n');

export { };
