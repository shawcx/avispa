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
    events() {
        return {
            'mousedown.avispa'      : 'OnMouseDown',
            'mousemove.avispa'      : 'OnMouseMove',
            'mouseup.avispa'        : 'OnMouseUp',
            'mousewheel.avispa'     : 'OnMouseWheel',
            'DOMMouseScroll.avispa' : 'OnMouseWheel',
            'contextmenu.avispa'    : 'OnContextMenu',
            }
    }

    initialize(options) {
        context.a = this

        _.bindAll(this, 'render',
            'OnMouseDown', 'OnMouseMove', 'OnMouseUp', 'OnMouseWheel', 'OnContextMenu')

        this.scale    = 1.0
        this.links    = {}
        this.offset   = null
        this.dragItem = null
        this.arrow    = null

        this.position = {
            x: 0,
            y: 0
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

        this.$pan.x = parseInt(window.innerWidth  / 2)
        this.$pan.y = parseInt(window.innerHeight / 2)

        this.Pan(0,0)

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

    Zoom(delta) {
        let scale = (delta == 0) ? 1.0 : this.scale + delta * this.zoom.step
        if (scale >= this.zoom.min || scale <= this.zoom.max) {
            this.Scale(scale)
        }
        return this
    }

    Point(event) {
        // translates the client x,y into the surface x,y
        let point = this.el.createSVGPoint()
        point.x = event.clientX
        point.y = event.clientY
        point = point.matrixTransform(this.el.getScreenCTM().inverse())

        // account for the current pan and scale
        point.x = parseInt((point.x - this.$pan.x) / this.scale)
        point.y = parseInt((point.y - this.$pan.y) / this.scale)

        return [point.x, point.y]
    }

    OnMouseDown(event) {
        if (this.arrow) {
            this.arrow.Remove()
            this.arrow = null
            return cancelEvent(event)
        }

        switch (event.which) {
            case 1:
                this.LeftDown(event)
                break
            case 2:
                this.MiddleDown(event)
                break
            case 3:
                if (this.RightDown) {
                    this.RightDown(event)
                }
                break
        }

        return cancelEvent(event)
    }

    LeftDown(event) {
        //if event.shiftKey
        this.offset = [event.clientX, event.clientY]
    }

    MiddleDown(event) {
        this.Pan(-this.$pan.x + window.innerWidth / 2, -this.$pan.y + window.innerHeight / 2)
        this.Zoom(0)
        //this.$('#zoomslider').slider('option', 'value', 1)
    }

    OnMouseMove(event) {
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
            if (this.dragItem.jitter < 3) {
                switch (event.which) {
                    case 1:
                        this.dragItem.LeftClick(event)
                        break
                    case 2:
                        this.dragItem.MiddleClick(event)
                        break
                    case 3:
                        this.dragItem.RightClick(event)
                        break
                }
            }
            else if(this.dragItem.MouseUp) {
                this.dragItem.MouseUp(event)
            }
            this.dragItem = null
        }
        else {
            switch (event.which) {
                case 1:
                    this.LeftClick(event)
                    break
                case 2:
                    this.MiddleClick(event)
                    break
                case 3:
                    this.RightClick(event)
                    break
            }
        }

        return cancelEvent(event)
    }

    OnMouseWheel(event) {
        this.Zoom(normalizeWheel(event))
        //this.$('#zoomslider').slider('option', 'value', this.scale)
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
