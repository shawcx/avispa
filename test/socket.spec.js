'use strict'

// Tests for js/Socket.js, and Avispa's socket option, in Chrome. Playwright
// stands in for the server (page.routeWebSocket); unrouted connections hit the
// static test server, which refuses the upgrade, like a server that is down. A
// fake page clock drives the reconnect and keepalive timers.

const fs   = require('fs')
const path = require('path')
const { test, expect } = require('@playwright/test')

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'js', 'Socket.js'), 'utf8')

let errors

test.beforeEach(({ page }) => {
    errors = []
    page.on('pageerror', error => errors.push(error.message))
})

test.afterEach(() => {
    expect(errors).toEqual([])
})

// a fake page clock that only moves when a test runs it forward (an installed
// clock otherwise keeps pace with real time)
async function pauseClock(page) {
    await page.clock.install({ time: 0 })
    await page.clock.pauseAt(1000)
}

// Socket.js has no requires, so it loads as-is with a stand-in `module`
async function loadSocket(page) {
    await page.goto('/')
    await page.addScriptTag({ content: `(function (module) {\n${SOURCE}\nwindow.Socket = module.exports\n})({})` })
}

// opens `window.socket` with callbacks that record into `window.events`, and
// counts every connection attempt in `window.attempts`
function open(page, options = {}) {
    return page.evaluate(options => {
        const events  = window.events = { open: 0, close: [], error: 0, messages: [] }
        const socket  = window.socket = new window.Socket(Object.assign({
            onopen:    ()    => events.open++,
            onclose:   event => events.close.push(event.code),
            onerror:   ()    => events.error++,
            onmessage: msg   => events.messages.push(msg),
            }, options))

        window.attempts = 1
        const connect = socket.connect.bind(socket)
        socket.connect = () => {
            window.attempts++
            connect()
        }
    }, options)
}

const events   = page => page.evaluate(() => window.events)
const opens    = async page => (await events(page)).open
const closes   = async page => (await events(page)).close.length
const attempts = page => page.evaluate(() => window.attempts)

// stands in for the server: keeps each connection open and records what it receives
async function serve(page, onConnect = () => {}) {
    const server = { connections: [], received: [] }
    await page.routeWebSocket(/\/ws$/, ws => {
        server.connections.push(ws)
        ws.onMessage(message => server.received.push(message))
        onConnect(ws)
    })
    return server
}


test('connects to /ws on the page\'s host and flushes queued sends in order', async ({ page }) => {
    const server = await serve(page)
    await loadSocket(page)

    await page.evaluate(() => {
        const socket = new window.Socket({ path: 'ws' })
        socket.send({ n: 1 })
        socket.sendraw('two')
        socket.send({ n: 3 })
    })

    await expect.poll(() => server.received).toEqual(['{"n":1}', 'two', '{"n":3}'])
    expect(server.connections[0].url()).toBe('ws://127.0.0.1:8123/ws')
})

test('inbound frames are parsed; pong and bad JSON are dropped without throwing', async ({ page }) => {
    await serve(page, ws => {
        ws.send('pong')
        ws.send('{not json')
        ws.send(JSON.stringify({ hello: 'world' }))
    })
    await loadSocket(page)
    await open(page)

    await expect.poll(async () => (await events(page)).messages).toEqual([{ hello: 'world' }])
    expect((await events(page)).error).toBe(1)
})

test('pings at the keepalive interval while open', async ({ page }) => {
    await pauseClock(page)
    const server = await serve(page)
    await loadSocket(page)
    await open(page, { ping: 30 })
    await expect.poll(() => opens(page)).toBe(1)

    await page.clock.runFor(3 * 30 * 1000)
    await expect.poll(() => server.received).toEqual(['ping', 'ping', 'ping'])
})

test('reconnects with doubling backoff capped at maxtime, reset by a good connection', async ({ page }) => {
    await pauseClock(page)
    await loadSocket(page)
    await open(page, { timeout: 1, maxtime: 4 })

    // once the page has seen `n` closes, the next attempt comes exactly `seconds` later
    async function retriesAfter(n, seconds) {
        await expect.poll(() => closes(page)).toBe(n)
        await page.clock.runFor(seconds * 1000 - 1)
        expect(await attempts(page)).toBe(n)
        await page.clock.runFor(1)
        expect(await attempts(page)).toBe(n + 1)
    }

    // unrouted: each attempt is refused
    await retriesAfter(1, 1)
    await retriesAfter(2, 2)
    await retriesAfter(3, 4)
    expect(await opens(page)).toBe(0)

    // the 5th attempt (still at the 4s cap) connects, which resets the backoff
    const server = await serve(page)
    await retriesAfter(4, 4)
    await expect.poll(() => opens(page)).toBe(1)

    await server.connections[0].close()
    await retriesAfter(5, 1)
})

test('close() stops reconnecting, whether open or waiting to retry', async ({ page }) => {
    await pauseClock(page)
    await loadSocket(page)

    // waiting to retry after a refused attempt
    await open(page, { timeout: 1 })
    await expect.poll(() => closes(page)).toBe(1)
    await page.evaluate(() => window.socket.close())
    await page.clock.runFor(60 * 1000)
    expect(await attempts(page)).toBe(1)

    // open
    await serve(page)
    await open(page, { timeout: 1 })
    await expect.poll(() => opens(page)).toBe(1)
    await page.evaluate(() => window.socket.close())
    await expect.poll(() => closes(page)).toBe(1)
    await page.clock.runFor(60 * 1000)
    expect(await attempts(page)).toBe(1)
})

test('close code 4004 reloads the page', async ({ page }) => {
    const server = await serve(page)
    await loadSocket(page)
    await open(page)
    await expect.poll(() => opens(page)).toBe(1)

    await Promise.all([
        page.waitForEvent('load'),
        server.connections[0].close({ code: 4004 }),
    ])
    expect(await page.evaluate(() => typeof window.Socket)).toBe('undefined')
})

// Avispa's `socket` option, through the example's bundle. Each new Avispa takes
// over the page from the example's graph, which this test leaves alone.
test('an Avispa socket delivers to OnMessage, or to its own onmessage, and remove() closes it', async ({ page }) => {
    const server = await serve(page, ws => {
        ws.onClose(() => server.closed++)
        ws.send(JSON.stringify({ hello: 'graph' }))
    })
    server.closed = 0
    await page.goto('/example.html')
    await page.waitForSelector('g.link')

    await page.evaluate(() => {
        const { Avispa } = window.example
        const got = window.got = { hook: [], own: [] }
        class Graph extends Avispa.Avispa {
            OnMessage(msg) {
                got.hook.push(msg)
            }
        }
        const svg = () => Avispa.$SVG('svg').appendTo(document.body)
        window.graphs = [
            new Graph({ el: svg(), socket: 'ws' }),
            new Graph({ el: svg(), socket: { path: 'ws', onmessage: msg => got.own.push(msg) } }),
        ]
    })
    await expect.poll(() => page.evaluate(() => window.got))
        .toEqual({ hook: [{ hello: 'graph' }], own: [{ hello: 'graph' }] })

    await page.evaluate(() => window.graphs.forEach(graph => graph.remove()))
    await expect.poll(() => server.closed).toBe(2)
})
