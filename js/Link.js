'use strict'

const _        = require('underscore')
const Backbone = require('backbone')

const { cancelEvent, $SVG } = require('./Utils.js')
const context               = require('./Context.js')


class Link extends Backbone.View {
    static RAD = 180.0 / Math.PI

    el() {
        return $SVG('g').attr('class', 'link')
    }

    events() {
        return {
            'mousedown'   : 'OnMouseDown',
            'mouseenter'  : 'OnMouseEnter',
            'mouseleave'  : 'OnMouseLeave',
            'contextmenu' : 'OnContextMenu',
            }
    }

    initialize(options) {
        this.path = $SVG('path')
            .css('marker-end', 'url(#Arrow)')
            .css('opacity', '0.5')
            .appendTo(this.$el)

        _.bindAll(this, 'render', 'OnMouseDown', 'OnMouseEnter', 'OnMouseLeave', 'OnContextMenu')

        this.arc = new Backbone.Model({arc:10})
        this.arc.bind('change', this.render, this)

        this.left  = options.left
        this.right = options.right
        this.left.position.bind('change', this.render, this)
        this.right.position.bind('change', this.render, this)

        this.render()

        if (options.parent) {
            options.parent.$links.append(this.$el)
        }
    }

    update() {
        //this.label.text(name)
        return
    }

    render() {
        if (!this.arc) { return this }

        let arc = this.arc.get('arc')
        let lx = this.left.position.get('x')
        let ly = this.left.position.get('y')
        let rx = this.right.position.get('x')
        let ry = this.right.position.get('y')

        // calculate the angle between 2 nodes
        let ang = Math.atan2(rx - lx, ry - ly)

        // bound the offset to about half the circle
        let offset = Math.max(-1.5, Math.min(1.5, arc / 100))

        // draw to the edge of the node
        lx +=  30 * Math.sin(ang + offset)
        ly +=  30 * Math.cos(ang + offset)
        rx += -33 * Math.sin(ang - offset)
        ry += -33 * Math.cos(ang - offset)

        // calculate the the position for the quadratic bezier curve
        let xc = ((lx + rx) >> 1) + arc * Math.cos(ang)
        let yc = ((ly + ry) >> 1) - arc * Math.sin(ang)

        let mx = xc - (arc>>1) * Math.cos(ang)
        let my = yc + (arc>>1) * Math.sin(ang)

        let rot = -(this.RAD * ang)
        rot += (rot > 0 && rot < 180) ? -90 : 90

        this.path.attr('d', "M #{lx} #{ly} Q #{xc} #{yc} #{rx} #{ry}")
        //this.label.attr('x', mx).attr('y', my).attr('transform', "rotate(#{rot}, #{mx} #{my})")

        return this
    }

// Events

    Drag(event) {
        let [x,y] = context.a.Point(event)

        let from_x = this.left.position.get('x')
        let from_y = this.left.position.get('y')
        let to_x   = this.right.position.get('x')
        let to_y   = this.right.position.get('y')

        let d = (to_x - from_x) * (y - from_y) - (to_y - from_y) * (x - from_x)

        if (d) {
            d = Math.pow(Math.abs(d), 0.5) * (d > 0) ? -1 : 1
        }

        if (!this.od && this.od != 0) {
            this.od = d
        }

        // will trigger a call to render
        this.arc.set('arc', Math.max(0, this.oarc + d - this.od))
    }

    OnMouseDown(event) {
        this.jitter = 0

        context.a.dragItem = this
        this.oarc = this.arc.get('arc')
        this.od = null

        return cancelEvent(event)
    }

    MouseUp(event) {
        if (this.jitter > 3) {
            this.path.css('stroke-width', '3px')
        }
    }

    OnMouseEnter() {
        if (!context.a.dragItem) {
            this.path.css('stroke-width', '6px')
        }
    }

    OnMouseLeave() {
        if (!context.a.dragItem) {
            this.path.css('stroke-width', '3px')
        }
    }

    LeftClick(event) {
        if (event.shiftKey) {
            this.arc.set('arc', 0)
        }
    }

    OnContextMenu(event) {
    }
}

module.exports = Link

