'use strict'

const { defineConfig } = require('@playwright/test')

// not 8000, so a running `npm run example` server isn't mistaken for this one
const PORT = 8123

module.exports = defineConfig({
    testDir: 'test',
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        // the installed Google Chrome, so no Playwright browser download is needed
        channel: 'chrome',
        viewport: { width: 1280, height: 800 },
    },
    // serves the example as built by `npm test`'s pretest step; the request
    // log goes to stderr, so it's dropped
    webServer: {
        command: `python3 -m http.server ${PORT} --bind 127.0.0.1 --directory example`,
        url: `http://127.0.0.1:${PORT}/example.html`,
        reuseExistingServer: false,
        stderr: 'ignore',
    },
})
