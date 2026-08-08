/**
 * BiDi migration lint — reports raw text/input primitives only (no other ESLint rules).
 * Run: npm run lint:bidi
 */
module.exports = {
    root: true,
    env: {
        browser: true,
        es2022: true,
    },
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
    },
    plugins: ['bidi', 'react-hooks'],
    rules: {
        'bidi/no-raw-text-elements': 'warn',
        'bidi/no-raw-text-input': 'warn',
        /* Satisfy inline eslint-disable comments without enabling hook lint in this pass. */
        'react-hooks/exhaustive-deps': 'off',
        'react-hooks/rules-of-hooks': 'off',
    },
    ignorePatterns: [
        'dist/**',
        'node_modules/**',
        'backups/**',
        '_backups/**',
        'src/components/base/**',
        'src/features/motion-post/templates/**',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/*.test.{js,jsx,ts,tsx}',
    ],
};
