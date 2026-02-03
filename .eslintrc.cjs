module.exports = {
    root: true,
    env: { browser: true, es2020: true },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'react-refresh'],
    rules: {
        'react-refresh/only-export-components': [
            'warn',
            { allowConstantExport: true },
        ],
        // ----------------------------------------------------------------------
        // TIME ARCHITECTURE ENFORCEMENT RULES
        // ----------------------------------------------------------------------
        'no-restricted-syntax': [
            'error',
            {
                selector: 'NewExpression[callee.name="Date"]',
                message: '⛔ STOP: new Date() is FORBIDDEN in business logic. Use utils/time (nowIST, toISTDateString) or sessionStatusUtils.',
            },
            {
                selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
                message: '⛔ STOP: Date.now() is FORBIDDEN. Use nowIST() from utils/time.',
            },
            {
                selector: 'CallExpression[callee.object.name="Date"][callee.property.name="UTC"]',
                message: '⛔ STOP: Date.UTC() is FORBIDDEN. Use utils/time helpers.',
            },
            {
                selector: 'CallExpression[callee.property.name="toLocaleDateString"]',
                message: '⚠️ WARNING: toLocaleDateString() uses browser timezone. Use formatIST() from utils/time.',
            }
        ],
    },
    // OFF-SWITCH: Allow Date usage only in the Time Utility itself
    overrides: [
        {
            files: ['src/utils/time.ts', 'src/utils/sessionStatusUtils.ts'],
            rules: {
                'no-restricted-syntax': 'off'
            }
        }
    ]
}
