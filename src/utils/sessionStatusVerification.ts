/**
 * Session Status Implementation Verification
 * 
 * Run this in browser console to verify the fix is working correctly
 */

// Test the shared utility directly
import { getSessionStatus, isSessionPast, BUFFER_MINUTES } from '../utils/sessionStatusUtils';

import { appLogger } from '../shared/logger';
appLogger.info('🧪 SESSION STATUS VERIFICATION TEST');
appLogger.info('===================================\n');

// Test Case 1: Session that just ended (within buffer)
const testSession1 = {
    _id: 'test-1',
    name: 'Just Ended Session',
    startDate: new Date(),
    startTime: '11:00',
    endTime: '19:00', // Ended 5 minutes ago
    isCancelled: false,
    isCompleted: false
};

// Create a time that's 5 minutes after end time (within 10-min buffer)
const now1Date = new Date();
now1Date.setHours(19, 5, 0, 0);
const now1 = now1Date.getTime();

const status1 = getSessionStatus(testSession1, now1);
const isPast1 = isSessionPast(testSession1, now1);

appLogger.info('TEST 1: Session 5 minutes after end time');
appLogger.info('Expected: live (within 10-minute buffer)');
appLogger.info(`Actual: ${status1}`);
appLogger.info(`isPast: ${isPast1}`);
appLogger.info(`✅ PASS: ${status1 === 'live' && !isPast1}\n`);

// Test Case 2: Session that's truly past (beyond buffer)
const now2Date = new Date();
now2Date.setHours(19, 15, 0, 0);
const now2 = now2Date.getTime();

const status2 = getSessionStatus(testSession1, now2);
const isPast2 = isSessionPast(testSession1, now2);

appLogger.info('TEST 2: Session 15 minutes after end time');
appLogger.info('Expected: past (beyond 10-minute buffer)');
appLogger.info(`Actual: ${status2}`);
appLogger.info(`isPast: ${isPast2}`);
appLogger.info(`✅ PASS: ${status2 === 'past' && isPast2}\n`);

// Test Case 3: Currently live session
const now3Date = new Date();
now3Date.setHours(15, 0, 0, 0);
const now3 = now3Date.getTime();

const status3 = getSessionStatus(testSession1, now3);
const isPast3 = isSessionPast(testSession1, now3);

appLogger.info('TEST 3: Session currently in progress');
appLogger.info('Expected: live');
appLogger.info(`Actual: ${status3}`);
appLogger.info(`isPast: ${isPast3}`);
appLogger.info(`✅ PASS: ${status3 === 'live' && !isPast3}\n`);

// Test Case 4: Upcoming session
const now4Date = new Date();
now4Date.setHours(10, 0, 0, 0);
const now4 = now4Date.getTime();

const status4 = getSessionStatus(testSession1, now4);
const isPast4 = isSessionPast(testSession1, now4);

appLogger.info('TEST 4: Upcoming session');
appLogger.info('Expected: upcoming');
appLogger.info(`Actual: ${status4}`);
appLogger.info(`isPast: ${isPast4}`);
appLogger.info(`✅ PASS: ${status4 === 'upcoming' && !isPast4}\n`);

appLogger.info(`\n📊 Buffer Configuration: ${BUFFER_MINUTES} minutes`);
appLogger.info('✅ All tests completed!');
