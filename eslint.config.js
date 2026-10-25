'use strict'

const js      = require('@eslint/js')
const globals = require('globals')

module.exports = [
    { ignores: ['example/example.js', '**/node_modules/', 'test-results/', 'playwright-report/'] },
    js.configs.recommended,
    {
        languageOptions: {
            sourceType: 'commonjs',
            globals:    { ...globals.browser, ...globals.commonjs },
        },
        rules: {
            // hooks name their arguments for subclasses to use
            'no-unused-vars': ['error', { args: 'none' }],
        },
    },
    {
        // run in Node, and hand functions to the page
        files: ['test/**', '*.config.js'],
        languageOptions: { globals: { ...globals.node, ...globals.browser } },
    },
]
