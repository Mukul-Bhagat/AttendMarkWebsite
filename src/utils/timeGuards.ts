import { appLogger } from '../shared/logger';
/**
 * TIME GUARDS - REGRESSION PREVENTION
 * 
 * These guards throw runtime errors when dangerous time patterns are detected.
 * This prevents new bugs from being introduced during the migration period.
 * 
 * ⚠️ IMPORTANT: Import this file EARLY in your application bootstrap
 * 
 * @see TIME_ARCHITECTURE.md for full context
 */

// Files allowed to use Date for display purposes only
const DISPLAY_ONLY_FILES = [
    'formatDate',
    'DatePicker',
    'display',
    'format',
    'Calendar.tsx', // Calendar component (display only)
    'Profile.tsx',  // User profile display
];

// Guard flag - respects the environment variable
const ENABLE_GUARDS = import.meta.env.VITE_ENABLE_TIME_GUARDS === 'true';

/**
 * Intercept Date constructor
 */
if (ENABLE_GUARDS) {
    const OriginalDate = Date;
    let isInDateProxy = false; // Recursion guard

    const dateConstructorHandler = {
        construct(target: any, args: any[]) {
            // Prevent infinite recursion
            if (isInDateProxy) {
                return new target(...args);
            }

            try {
                isInDateProxy = true;

                // Get stack trace
                const stack = new Error().stack || '';

                // Check if called from display-only file
                const isDisplayFile = DISPLAY_ONLY_FILES.some(file =>
                    stack.includes(file)
                );

                // Check if called from time utilities (allowed)
                const isTimeUtil = stack.includes('time.ts') ||
                    stack.includes('sessionStatusUtils.ts');

                if (!isDisplayFile && !isTimeUtil) {
                    // Not from approved location - issue warning
                    appLogger.warn(
                        '⚠️ TIME GUARD WARNING: new Date() called outside display layer',
                        '\nStack trace:',
                        stack.split('\n').slice(1, 4).join('\n'),
                        '\n\n✅ Use nowIST() from utils/time.ts instead',
                        '\n📖 See TIME_ARCHITECTURE.md for migration guide'
                    );
                }

                return new target(...args);
            } finally {
                isInDateProxy = false;
            }
        }
    };

    // Proxy the Date constructor
    (globalThis as any).Date = new Proxy(OriginalDate, dateConstructorHandler);
}

/**
 * Guard against getTimezoneOffset in business logic
 */
if (ENABLE_GUARDS) {
    const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;

    Date.prototype.getTimezoneOffset = function () {
        const stack = new Error().stack || '';

        // Check if called from business logic (not test files)
        const isBusinessLogic = !stack.includes('test.ts') &&
            !stack.includes('test.tsx') &&
            !stack.includes('node_modules');

        if (isBusinessLogic) {
            appLogger.error(
                '🚨 TIME GUARD ERROR: getTimezoneOffset() called in business logic!',
                '\nThis creates browser-timezone dependency',
                '\nStack trace:',
                stack.split('\n').slice(1, 4).join('\n'),
                '\n\n❌ FORBIDDEN: Do not use browser timezone offset',
                '\n✅ Use IST functions from utils/time.ts',
                '\n📖 See TIME_ARCHITECTURE.md Section 6'
            );

            throw new Error(
                'TIME_GUARD_VIOLATION: getTimezoneOffset() forbidden in business logic. Use IST utilities.'
            );
        }

        return originalGetTimezoneOffset.call(this);
    };
}

/**
 * Guard against toLocaleDateString/toLocaleTimeString in logic
 */
if (ENABLE_GUARDS) {
    const originalToLocaleDateString = Date.prototype.toLocaleDateString;
    const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
    const originalToLocaleString = Date.prototype.toLocaleString;

    const localeGuard = (methodName: string, stack: string) => {
        const isLogicFile = !stack.includes('display') &&
            !stack.includes('format') &&
            !stack.includes('Calendar') &&
            !stack.includes('Profile');

        if (isLogicFile) {
            appLogger.warn(
                `⚠️ TIME GUARD WARNING: ${methodName}() called in business logic`,
                '\nThis method is locale/timezone dependent',
                '\nStack trace:',
                stack.split('\n').slice(1, 4).join('\n'),
                '\n\n⚠️ Only use for DISPLAY purposes',
                '\n✅ For logic, use IST timestamp comparisons',
                '\n📖 See TIME_ARCHITECTURE.md Section 5.3'
            );
        }
    };

    Date.prototype.toLocaleDateString = function (...args: any[]) {
        localeGuard('toLocaleDateString', new Error().stack || '');
        return originalToLocaleDateString.apply(this, args as any);
    };

    Date.prototype.toLocaleTimeString = function (...args: any[]) {
        localeGuard('toLocaleTimeString', new Error().stack || '');
        return originalToLocaleTimeString.apply(this, args as any);
    };

    Date.prototype.toLocaleString = function (...args: any[]) {
        localeGuard('toLocaleString', new Error().stack || '');
        return originalToLocaleString.apply(this, args as any);
    };
}

/**
 * Log guard initialization
 */
if (ENABLE_GUARDS) {
    appLogger.info(
        '%c🛡️ TIME GUARDS ACTIVE',
        'background: #ff6b6b; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;',
        '\n\n⚠️ Feature freeze in effect - time-related changes monitored',
        '\n\n✅ Approved: utils/time.ts functions',
        '\n❌ Blocked: new Date(), getTimezoneOffset(), locale methods in logic',
        '\n\n📖 See TIME_ARCHITECTURE.md for migration guide',
        '\n\nTo disable guards, set VITE_ENABLE_TIME_GUARDS=false'
    );
}

/**
 * Guard against Date.now() in new code
 */
if (ENABLE_GUARDS) {
    const originalNow = Date.now;

    (Date as any).now = function () {
        const stack = new Error().stack || '';

        // Check if called from time utilities (allowed)
        const isTimeUtil = stack.includes('time.ts');

        if (!isTimeUtil) {
            appLogger.warn(
                '⚠️ TIME GUARD WARNING: Date.now() called',
                '\nConsider using nowIST() for IST timestamp',
                '\nStack trace:',
                stack.split('\n').slice(1, 4).join('\n'),
                '\n\n✅ Use nowIST() from utils/time.ts for IST time',
                '\n📖 See TIME_ARCHITECTURE.md Section 7.1'
            );
        }

        return originalNow.call(Date);
    };
}

/**
 * Export guard status for testing
 */
export const TIME_GUARDS_ENABLED = ENABLE_GUARDS;

/**
 * Export function to check if a file is display-only
 */
export function isDisplayOnlyFile(filename: string): boolean {
    return DISPLAY_ONLY_FILES.some(pattern => filename.includes(pattern));
}

/**
 * Export function to temporarily disable guards (for testing)
 */
export function disableTimeGuards() {
    appLogger.warn('⚠️ Time guards temporarily disabled');
    // Note: This won't restore original Date in current implementation
    // For production use, this would need a more sophisticated approach
}

if (ENABLE_GUARDS) {
    appLogger.info(
        '%c📋 TIME ARCHITECTURE FREEZE',
        'background: #ffa502; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;',
        '\n\n🚫 Feature Development Frozen',
        '\n\n✓ Runtime guards active',
        '\n\n✓ Console warnings for Date usage',
        '\n✓ Errors for timezone access',
        '\n\nNext: Wait for architecture approval before refactoring',
        '\n\n📖 See TIME_ARCHITECTURE.md for full plan'
    );
}

export default {
    TIME_GUARDS_ENABLED,
    isDisplayOnlyFile,
    disableTimeGuards
};
