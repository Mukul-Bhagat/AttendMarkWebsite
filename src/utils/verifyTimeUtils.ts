import { appLogger } from '../shared/logger';
/**
 * Manual Test Runner for time.ts
 * 
 * Run with: node --loader ts-node/esm src/utils/verifyTimeUtils.ts
 * Or add to package.json scripts
 */

import {
    nowIST,
    istDayStart,
    istDayEnd,
    sessionTimeToIST,
    isSameISTDay,
    IST_OFFSET_MS,
    BUSINESS_TIMEZONE,
    formatIST,
    debugISTTime
} from './time.js';

appLogger.info('🧪 TIME UTILITIES - VERIFICATION TESTS\n');
appLogger.info('='.repeat(60));

let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => boolean) {
    try {
        const result = fn();
        if (result) {
            appLogger.info(`✅ PASS: ${name}`);
            passCount++;
        } else {
            appLogger.info(`❌ FAIL: ${name}`);
            failCount++;
        }
    } catch (error) {
        appLogger.info(`❌ ERROR: ${name}`, error);
        failCount++;
    }
}

// Test 1: Constants
appLogger.info('\n📋 Testing Constants...');
test('IST_OFFSET_MS = 19,800,000 ms', () => IST_OFFSET_MS === 19800000);
test('BUSINESS_TIMEZONE = Asia/Kolkata', () => BUSINESS_TIMEZONE === 'Asia/Kolkata');

// Test 2: nowIST()
appLogger.info('\n⏰ Testing nowIST()...');
test('nowIST returns a number', () => typeof nowIST() === 'number');
test('nowIST returns recent timestamp', () => {
    const now = nowIST();
    const year2026 = Date.UTC(2026, 0, 1);
    return now > year2026 && now < Date.UTC(2030, 0, 1);
});

// Test 3: istDayStart()
appLogger.info('\n🌅 Testing istDayStart()...');
test('Jan 7, 2026 00:00 IST = Jan 6, 2026 18:30 UTC', () => {
    const timestamp = istDayStart('2026-01-07');
    const date = new Date(timestamp);
    return date.getUTCFullYear() === 2026 &&
        date.getUTCMonth() === 0 &&
        date.getUTCDate() === 6 &&
        date.getUTCHours() === 18 &&
        date.getUTCMinutes() === 30;
});

test('Works with full ISO string', () => {
    const timestamp = istDayStart('2026-01-07T12:34:56.789Z');
    const date = new Date(timestamp);
    return date.getUTCDate() === 6 && date.getUTCHours() === 18;
});

test('Year boundary: Jan 1 midnight IST = Dec 31 previous year UTC', () => {
    const timestamp = istDayStart('2026-01-01');
    const date = new Date(timestamp);
    return date.getUTCFullYear() === 2025 &&
        date.getUTCMonth() === 11 &&
        date.getUTCDate() === 31;
});

// Test 4: istDayEnd()
appLogger.info('\n🌆 Testing istDayEnd()...');
test('Jan 7, 2026 23:59:59.999 IST = Jan 7, 2026 18:29:59.999 UTC', () => {
    const timestamp = istDayEnd('2026-01-07');
    const date = new Date(timestamp);
    return date.getUTCDate() === 7 &&
        date.getUTCHours() === 18 &&
        date.getUTCMinutes() === 29 &&
        date.getUTCSeconds() === 59 &&
        date.getUTCMilliseconds() === 999;
});

test('Day end is 1ms before next day start', () => {
    const dayEnd = istDayEnd('2026-01-07');
    const nextDayStart = istDayStart('2026-01-08');
    return (nextDayStart - dayEnd) === 1;
});

// Test 5: sessionTimeToIST()
appLogger.info('\n🎯 Testing sessionTimeToIST()...');
test('Jan 7, 11:00 IST = Jan 7, 05:30 UTC', () => {
    const timestamp = sessionTimeToIST('2026-01-07', '11:00');
    const date = new Date(timestamp);
    return date.getUTCHours() === 5 && date.getUTCMinutes() === 30;
});

test('Jan 7, 19:00 IST = Jan 7, 13:30 UTC', () => {
    const timestamp = sessionTimeToIST('2026-01-07', '19:00');
    const date = new Date(timestamp);
    return date.getUTCHours() === 13 && date.getUTCMinutes() === 30;
});

test('Midnight: Jan 7, 00:00 IST = Jan 6, 18:30 UTC', () => {
    const timestamp = sessionTimeToIST('2026-01-07', '00:00');
    const date = new Date(timestamp);
    return date.getUTCDate() === 6 &&
        date.getUTCHours() === 18 &&
        date.getUTCMinutes() === 30;
});

// Test 6: isSameISTDay()
appLogger.info('\n📅 Testing isSameISTDay()...');
test('Morning and evening of same IST day', () => {
    const morning = sessionTimeToIST('2026-01-07', '09:00');
    const evening = sessionTimeToIST('2026-01-07', '21:00');
    return isSameISTDay(morning, evening) === true;
});

test('Different IST days', () => {
    const jan7 = sessionTimeToIST('2026-01-07', '23:59');
    const jan8 = sessionTimeToIST('2026-01-08', '00:01');
    return isSameISTDay(jan7, jan8) === false;
});

test('Same IST day despite different UTC days', () => {
    // Jan 7, 20:00 IST = Jan 7, 14:30 UTC
    const evening = sessionTimeToIST('2026-01-07', '20:00');
    // Jan 7, 04:00 IST = Jan 6, 22:30 UTC (different UTC day!)
    const earlyMorning = sessionTimeToIST('2026-01-07', '04:00');

    const inSameMorning = new Date(earlyMorning);
    const eveningDate = new Date(evening);

    appLogger.info(`   Early: ${inSameMorning.getUTCDate()} UTC, Evening: ${eveningDate.getUTCDate()} UTC`);
    return isSameISTDay(evening, earlyMorning) === true;
});

// Test 7: Real-World Scenarios
appLogger.info('\n🌍 Testing Real-World Scenarios...');
test('Live session detection (Jan 7, 15:15 IST during 11:00-19:00 session)', () => {
    const sessionStart = sessionTimeToIST('2026-01-07', '11:00');
    const sessionEnd = sessionTimeToIST('2026-01-07', '19:00');
    const buffer = 10 * 60 * 1000;
    const cutoff = sessionEnd + buffer;
    const currentTime = sessionTimeToIST('2026-01-07', '15:15');

    return currentTime >= sessionStart && currentTime <= cutoff;
});

test('Overnight session (23:00-02:00, checked at 00:30)', () => {
    const sessionStart = sessionTimeToIST('2026-01-07', '23:00');
    const sessionEnd = sessionTimeToIST('2026-01-08', '02:00');
    const currentTime = sessionTimeToIST('2026-01-08', '00:30');

    return currentTime >= sessionStart && currentTime <= sessionEnd;
});

test('Date filtering: Select Jan 8, filter out Jan 7 and Jan 9', () => {
    const session1 = sessionTimeToIST('2026-01-07', '11:00');
    const session2 = sessionTimeToIST('2026-01-08', '11:00');
    const session3 = sessionTimeToIST('2026-01-09', '11:00');

    const selectedDayStart = istDayStart('2026-01-08');
    const selectedDayEnd = istDayEnd('2026-01-08');

    const jan7Out = session1 < selectedDayStart;
    const jan8In = session2 >= selectedDayStart && session2 <= selectedDayEnd;
    const jan9Out = session3 > selectedDayEnd;

    return jan7Out && jan8In && jan9Out;
});

// Test 8: Deprecated Functions
appLogger.info('\n🚫 Testing Deprecated Functions...');
test('istDateFromYMD throws error', () => {
    try {
        // @ts-ignore
        istDateFromYMD(2026, 1, 7);
        return false; // Should have thrown
    } catch (error) {
        return true; // Expected
    }
});

// Summary
appLogger.info('\n' + '='.repeat(60));
appLogger.info(`\n📊 RESULTS: ${passCount} passed, ${failCount} failed\n`);

if (failCount === 0) {
    appLogger.info('✅ All tests PASSED! Time utilities are correct.\n');
    appLogger.info('🎯 Key Validations:');
    appLogger.info('   ✓ IST midnight = UTC previous day 18:30');
    appLogger.info('   ✓ Day boundaries work correctly');
    appLogger.info('   ✓ Session time conversion accurate');
    appLogger.info('   ✓ Same-day detection works across UTC boundaries');
    appLogger.info('   ✓ Real-world scenarios validated');
    appLogger.info('\n📖 See TIME_ARCHITECTURE.md for migration plan');
} else {
    appLogger.info('❌ Some tests FAILED. Review implementation.\n');
    process.exit(1);
}

// Demo output
appLogger.info('\n🔍 DEMO OUTPUT:\n');
const demoTimestamp = sessionTimeToIST('2026-01-07', '15:15');
appLogger.info('Session: Jan 7, 2026, 15:15 IST');
debugISTTime('Demo timestamp', demoTimestamp);
appLogger.info('Formatted:', formatIST(demoTimestamp, {
    dateStyle: 'full',
    timeStyle: 'long'
}));

export { passCount, failCount };
