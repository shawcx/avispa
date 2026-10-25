'use strict'

const _        = require('underscore')
const Backbone = require('backbone')

const { Position }                     = require('./Types.js')
const { cancelEvent, $SVG, normalizeWheel } = require('./Utils.js')

const context      = require('./Context.js')
const Group        = require('./Group.js')
const Node         = require('./Node.js')
const Link         = require('./Link.js')
const Socket       = require('./Socket.js')

class Avispa extends Backbone.View {
    static TOUCH_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']

    events() {
        return {
            'pointerdown.avispa'   : 'OnMouseDown',
            'pointermove.avispa'   : 'OnMouseMove',
            'pointerup.avispa'     : 'OnMouseUp',
            'pointercancel.avispa' : 'OnPointerCancel',
            'wheel.avispa'         : 'OnMouseWheel',
            'contextmenu.avispa'   : 'OnContextMenu',
            }
    }

    initialize(options) {
        context.a = this

        // the surface handles its own drags: keep touch from panning the page
        // and drags from selecting text
        this.$el.css({'touch-action': 'none', 'user-select': 'none'})

        _.bindAll(this, 'render',
            'OnMouseDown', 'OnMouseMove', 'OnMouseUp', 'OnMouseWheel', 'OnContextMenu', 'OnTouch')

        this.scale    = 1.0
        this.offset   = null
        this.dragItem = null
        this.arrow    = null

        // touch points by pointerId, as client [x, y], and the pinch two of
        // them make. Watched in the capture phase, since items stop pointerdown
        // from bubbling up to the surface
        this.touches  = new Map()
        this.pinch    = null
        for (const type of Avispa.TOUCH_EVENTS) {
            this.el.addEventListener(type, this.OnTouch, true)
        }

        this.zoom = {
            step : 0.125,
            min  : 0.125,
            max  : 2.5,
            }

        this.$parent  = this.$el.parent()

        this.$pan     = this.$el.find('g.pan')
        this.$zoom    = this.$el.find('g.zoom')

        this.$groups  = this.$el.find('g.groups')
        this.$links   = this.$el.find('g.links')
        this.$objects = this.$el.find('g.objects')
        this.$labels  = this.$el.find('g.labels')

        this.$pan.x = 0
        this.$pan.y = 0

        this.Center()

        // opt-in WebSocket transport: `socket` may be a path string or a
        // Socket options object. Incoming messages are routed to OnMessage
        // unless the caller supplies its own onmessage handler.
        if (options && options.socket) {
            let socketOptions = (typeof options.socket === 'string')
                ? { path: options.socket }
                : Object.assign({}, options.socket)

            if (!socketOptions.onmessage) {
                socketOptions.onmessage = (msg) => this.OnMessage(msg)
            }

            this.socket = new Socket(socketOptions)
        }
    }

    remove() {
        if (this.socket) {
            this.socket.close()
        }
        for (const type of Avispa.TOUCH_EVENTS) {
            this.el.removeEventListener(type, this.OnTouch, true)
        }
        return super.remove()
    }

    Pan(dx, dy) {
        this.$pan.x += dx
        this.$pan.y += dy

        this.$pan.attr('transform', `translate(${this.$pan.x}, ${this.$pan.y})`)
        this.$parent.css('background-position', `${this.$pan.x}px ${this.$pan.y}px`)

        return this
    }

    Scale(scale) {
        this.scale = scale
        this.$zoom.attr('transform', `scale(${scale})`)
        return this
    }

    // put the surface's origin in the middle of the SVG
    Center() {
        let [x, y] = this.Middle()
        return this.Pan(parseInt(x) - this.$pan.x, parseInt(y) - this.$pan.y)
    }

    // zoom by `delta` steps (0 resets to 1), keeping what's drawn at `at`
    // where it is (see ZoomTo)
    Zoom(delta, at) {
        return this.ZoomTo((delta == 0) ? 1.0 : this.scale + delta * this.zoom.step, at)
    }

    // zoom to `scale` within the limits, keeping what's drawn at `at` (an
    // [x, y] from Local) where it is; without `at`, the origin stays put
    ZoomTo(scale, at) {
        scale = Math.min(this.zoom.max, Math.max(this.zoom.min, scale))
        if (!at) {
            return this.Scale(scale)
        }
        let point = this.Surface(at)
        this.Scale(scale)
        return this.PanTo(point, at)
    }

    // pan so the surface point `point` is drawn at `at` (an [x, y] from Local)
    PanTo(point, at) {
        return this.Pan(
            at[0] - point[0] * this.scale - this.$pan.x,
            at[1] - point[1] * this.scale - this.$pan.y)
    }

    // translates a client x,y into the SVG's own coordinates, before the pan
    // and zoom; an SVG that isn't laid out (display: none) has no transform
    Local(x, y) {
        let ctm = this.el.getScreenCTM()
        if (!ctm) {
            return [x, y]
        }
        let point = this.el.createSVGPoint()
        point.x = x
        point.y = y
        point = point.matrixTransform(ctm.inverse())
        return [point.x, point.y]
    }

    // the middle of the SVG, from Local
    Middle() {
        let box = this.el.getBoundingClientRect()
        return this.Local(box.left + box.width / 2, box.top + box.height / 2)
    }

    // the surface point drawn at `at` (an [x, y] from Local)
    Surface(at) {
        return [(at[0] - this.$pan.x) / this.scale, (at[1] - this.$pan.y) / this.scale]
    }

    Point(event) {
        // translates the client x,y into the surface x,y
        let [x, y] = this.Surface(this.Local(event.clientX, event.clientY))
        return [parseInt(x), parseInt(y)]
    }

    OnMouseDown(event) {
        if (this.arrow) {
            this.arrow.Remove()
            this.arrow = null
            return cancelEvent(event)
        }

        switch (event.button) {
            case 0:
                this.LeftDown(event)
                break
            case 1:
                this.MiddleDown(event)
                break
            case 2:
                if (this.RightDown) {
                    this.RightDown(event)
                }
                break
        }

        return cancelEvent(event)
    }

    LeftDown(event) {
        this.offset = [event.clientX, event.clientY]
    }

    MiddleDown(event) {
        this.Center()
        this.Zoom(0)
    }

    OnMouseMove(event) {
        // once a drag is moving, capture its pointer so the drag carries on
        // outside the SVG and its release comes back here. Not on pointerdown:
        // a plain click or double-click would then go to the SVG, not the item
        if ((this.offset || this.dragItem) && !this.el.hasPointerCapture(event.pointerId)) {
            this.el.setPointerCapture(event.pointerId)
        }

        // drag the entire scene around
        if (this.offset) {
            this.Pan(event.clientX - this.offset[0], event.clientY - this.offset[1])
            this.offset = [event.clientX, event.clientY]
        }
        else if (this.arrow) {
            this.arrow.Drag(event)
        }
        else if (this.dragItem) {
            this.dragItem.jitter++
            if (this.dragItem.Drag) {
                this.dragItem.Drag(event)
            }
        }

        return cancelEvent(event)
    }

    OnMouseUp(event) {
        this.offset = null

        if (this.dragItem) {
            // click hooks are optional on drag items (Link has no Middle/RightClick)
            if (this.dragItem.jitter < 3) {
                switch (event.button) {
                    case 0:
                        if (this.dragItem.LeftClick) this.dragItem.LeftClick(event)
                        break
                    case 1:
                        if (this.dragItem.MiddleClick) this.dragItem.MiddleClick(event)
                        break
                    case 2:
                        if (this.dragItem.RightClick) this.dragItem.RightClick(event)
                        break
                }
            }
            if (this.dragItem.MouseUp) {
                this.dragItem.MouseUp(event)
            }
            this.dragItem = null
        }
        else {
            switch (event.button) {
                case 0:
                    this.LeftClick(event)
                    break
                case 1:
                    this.MiddleClick(event)
                    break
                case 2:
                    this.RightClick(event)
                    break
            }
        }

        return cancelEvent(event)
    }

    OnPointerCancel(event) {
        // the browser took the pointer over: drop any pan or drag in progress
        this.offset   = null
        this.dragItem = null
    }

    // A second finger turns whatever the first one started into a pinch,
    // which zooms by how far apart the fingers move and pans with their
    // midpoint. It lasts until every finger is up, and until then the touches
    // go no further than here: lifting the last finger isn't a click.
    OnTouch(event) {
        // only touches that started here: one whose release never comes would
        // turn every later single touch into a pinch
        if (event.pointerType !== 'touch' ||
            (event.type !== 'pointerdown' && !this.touches.has(event.pointerId))) {
            return
        }

        if (event.type === 'pointerup' || event.type === 'pointercancel') {
            this.touches.delete(event.pointerId)
        }
        else {
            this.touches.set(event.pointerId, [event.clientX, event.clientY])
        }

        let [a, b] = this.touches.values()
        let middle = () => this.Local((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)

        if (event.type !== 'pointermove' && this.touches.size >= 2) {
            // a pinch starts, or its fingers changed: start over from here
            this.offset   = null
            this.dragItem = null
            this.pinch    = {
                distance : Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), 1),
                scale    : this.scale,
                point    : this.Surface(middle()),
                }
        }
        else if (event.type === 'pointermove' && this.pinch && this.touches.size >= 2) {
            let distance = Math.hypot(b[0] - a[0], b[1] - a[1])
            this.ZoomTo(this.pinch.scale * distance / this.pinch.distance)
            this.PanTo(this.pinch.point, middle())
        }

        if (this.pinch) {
            if (this.touches.size === 0) {
                this.pinch = null
            }
            event.preventDefault()
            event.stopImmediatePropagation()
        }
    }

    OnMouseWheel(event) {
        // a zero delta (a horizontal-only scroll) would reset the zoom to 1.0
        let delta = normalizeWheel(event)
        if (delta) {
            this.Zoom(delta, this.Local(event.clientX, event.clientY))
        }
        return cancelEvent(event)
    }

    LeftClick(event) {}
    MiddleClick(event) {}
    RightClick(event) {}
    OnContextMenu(event) {}
    OnMessage(msg) {}
}

exports.Avispa      = Avispa
exports.Position    = Position
exports.Group       = Group
exports.Node        = Node
exports.Link        = Link
exports.Socket      = Socket
exports.$SVG        = $SVG
exports.cancelEvent = cancelEvent
