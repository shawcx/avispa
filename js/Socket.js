'use strict'


const DEFAULTS = {
    url       : null,   // full ws(s):// URL; overrides `path` when set
    path      : 'ws',   // path appended to the current host
    timeout   : 0.9375, // seconds before the first reconnect attempt
    maxtime   : 60,     // reconnect backoff is capped at this many seconds
    ping      : 300,    // seconds between keepalive pings (0 disables)
    onopen    : function(event) {},
    onclose   : function(event) {},
    onerror   : function(error) {},
    onmessage : function(msg) {},
}


class Socket {
    constructor(options) {
        this.options = Object.assign({}, DEFAULTS, options)

        if (this.options.url) {
            this.wsurl = this.options.url
        }
        else {
            let protocol = location.protocol.replace('http', 'ws')
            this.wsurl = `${protocol}//${location.host}/${this.options.path}`
        }

        this.timeout  = this.options.timeout
        this.interval = null
        this.retry    = null
        this.queue    = []
        this.closed   = false

        this.connect()
    }

    connect() {
        this.ws = new WebSocket(this.wsurl)

        this.ws.onopen = (event) => {
            // successful connection: reset the backoff and flush queued sends
            this.timeout = this.options.timeout

            for (const message of this.queue.splice(0)) {
                this.ws.send(message)
            }

            if (this.options.ping) {
                this.interval = setInterval(() => {
                    if (this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send('ping')
                    }
                }, 1000 * this.options.ping)
            }

            this.options.onopen(event)
        }

        this.ws.onmessage = (event) => {
            if (event.data === 'pong') {
                return
            }

            let msg
            try {
                msg = JSON.parse(event.data)
            }
            catch (error) {
                this.options.onerror(error)
                return
            }

            this.options.onmessage(msg)
        }

        this.ws.onerror = (event) => {
            this.options.onerror(event)
        }

        this.ws.onclose = (event) => {
            clearInterval(this.interval)
            this.interval = null

            this.options.onclose(event)

            // application-level signal to force a full page reload
            if (event.code === 4004) {
                window.location.reload()
                return
            }

            // deliberate close() — do not reconnect
            if (this.closed) {
                return
            }

            this.retry = setTimeout(() => {
                this.retry = null
                this.connect()
            }, 1000 * this.timeout)

            // exponential backoff on every attempt, capped at maxtime
            this.timeout = Math.min(this.timeout * 2, this.options.maxtime)
        }
    }

    send(message) {
        this.sendraw(JSON.stringify(message))
    }

    sendraw(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(message)
        }
        else {
            // queued until the (re)connection opens
            this.queue.push(message)
        }
    }

    close() {
        this.closed = true
        clearInterval(this.interval)
        clearTimeout(this.retry)
        this.interval = null
        this.retry    = null
        if (this.ws) {
            this.ws.close()
        }
    }
}

module.exports = Socket
