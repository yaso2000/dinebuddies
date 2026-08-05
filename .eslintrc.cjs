/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    env: {
        browser: true,
        es2022: true,
        node: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
    ],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
    },
    settings: {
        react: { version: 'detect' },
    },
    plugins: ['react-refresh', 'bidi'],
    ignorePatterns: [
        'dist/**',
        'node_modules/**',
        'backups/**',
        '_backups/**',
        '.next/**',
        'public/**',
        'eslint-plugin-bidi/**',
    ],
    rules: {
        'react/prop-types': 'off',
        'react/no-unescaped-entities': 'off',
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
    overrides: [
        {
            files: ['src/components/**/*.{js,jsx}', 'src/pages/**/*.{js,jsx}', 'src/admin/**/*.{js,jsx}'],
            plugins: ['bidi'],
            rules: {
                'bidi/no-raw-text-elements': 'warn',
                'bidi/no-raw-text-input': 'warn',
            },
        },
        {
            files: ['api/**', 'functions/**', 'scripts/**'],
            env: { node: true, browser: false },
            rules: {
                'react-refresh/only-export-components': 'off',
            },
        },
    ],
};
