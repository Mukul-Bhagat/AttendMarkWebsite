/**
 * Session Status Implementation Verification
 * 
 * Run this in browser console to verify the fix is working correctly
 */

// Test the shared utility directly
import { getSessionStatus, isSessionPast, BUFFER_MINUTES } from '../utils/sessionStatusUtils';

console.log('🧪 SESSION STATUS VERIFICATION TEST');
console.log('===================================\n');

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
const now1 = new Date();
now1.setHours(19, 5, 0, 0);

const status1 = getSessionStatus(testSession1, now1);
const isPast1 = isSessionPast(testSession1, now1);

console.log('TEST 1: Session 5 minutes after end time');
console.log('Expected: live (within 10-minute buffer)');
console.log(`Actual: ${status1}`);
console.log(`isPast: ${isPast1}`);
console.log(`✅ PASS: ${status1 === 'live' && !isPast1}\n`);

// Test Case 2: Session that's truly past (beyond buffer)
const now2 = new Date();
now2.setHours(19, 15, 0, 0);

const status2 = getSessionStatus(testSession1, now2);
const isPast2 = isSessionPast(testSession1, now2);

console.log('TEST 2: Session 15 minutes after end time');
console.log('Expected: past (beyond 10-minute buffer)');
console.log(`Actual: ${status2}`);
console.log(`isPast: ${isPast2}`);
console.log(`✅ PASS: ${status2 === 'past' && isPast2}\n`);

// Test Case 3: Currently live session
const now3 = new Date();
now3.setHours(15, 0, 0, 0);

const status3 = getSessionStatus(testSession1, now3);
const isPast3 = isSessionPast(testSession1, now3);

console.log('TEST 3: Session currently in progress');
console.log('Expected: live');
console.log(`Actual: ${status3}`);
console.log(`isPast: ${isPast3}`);
console.log(`✅ PASS: ${status3 === 'live' && !isPast3}\n`);

// Test Case 4: Upcoming session
const now4 = new Date();
now4.setHours(10, 0, 0, 0);

const status4 = getSessionStatus(testSession1, now4);
const isPast4 = isSessionPast(testSession1, now4);

console.log('TEST 4: Upcoming session');
console.log('Expected: upcoming');
console.log(`Actual: ${status4}`);
console.log(`isPast: ${isPast4}`);
console.log(`✅ PASS: ${status4 === 'upcoming' && !isPast4}\n`);

console.log(`\n📊 Buffer Configuration: ${BUFFER_MINUTES} minutes`);
console.log('✅ All tests completed!');
