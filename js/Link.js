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

        // re-render when a group around either end collapses or expands
        for (const end of [this.left, this.right]) {
            for (let p = end.parent; p; p = p.parent) {
                p.position.bind('change:collapsed', this.render, this)
            }
        }

        this.render()

        if (options.parent) {
            options.parent.$links.append(this.$el)
        }
    }

    update() {
        //this.label.text(name)
        return
    }

    // the items the ends attach to: an end hidden inside a collapsed group
    // attaches to that group instead
    Ends() {
        return [
            this.left.CollapsedAncestor()  || this.left,
            this.right.CollapsedAncestor() || this.right,
            ]
    }

    // the point a link aims at: a node's center, or the middle of a collapsed group
    static Center(item) {
        let p = item.position
        if (p.get('collapsed')) {
            return [p.get('x') + p.get('w') / 2, p.get('y') + item.Height() / 2]
        }
        return [p.get('x'), p.get('y')]
    }

    // distance from Center(item) to the item's edge along the unit vector (ux, uy)
    static Edge(item, ux, uy) {
        if (!item.position.get('collapsed')) {
            return 30
        }
        return Math.min(
            item.position.get('w') / 2 / Math.abs(ux),
            item.Height()          / 2 / Math.abs(uy))
    }

    render() {
        if (!this.arc) { return this }

        let [left, right] = this.Ends()

        // both ends are hidden inside the same collapsed group
        if (left === right) {
            this.$el.css('display', 'none')
            return this
        }
        this.$el.css('display', '')

        let arc = this.arc.get('arc')
        let [lx, ly] = Link.Center(left)
        let [rx, ry] = Link.Center(right)

        // calculate the angle between 2 nodes
        let ang = Math.atan2(rx - lx, ry - ly)

        // bound the offset to about half the circle
        let offset = Math.max(-1.5, Math.min(1.5, arc / 100))

        // draw to the edge of each end, leaving room for the arrowhead
        let la = ang + offset
        let ra = ang - offset
        let ld = Link.Edge(left,  Math.sin(la), Math.cos(la))
        let rd = Link.Edge(right, Math.sin(ra), Math.cos(ra)) + 3
        lx += ld * Math.sin(la)
        ly += ld * Math.cos(la)
        rx -= rd * Math.sin(ra)
        ry -= rd * Math.cos(ra)

        // calculate the the position for the quadratic bezier curve
        let xc = ((lx + rx) >> 1) + arc * Math.cos(ang)
        let yc = ((ly + ry) >> 1) - arc * Math.sin(ang)

        let mx = xc - (arc>>1) * Math.cos(ang)
        let my = yc + (arc>>1) * Math.sin(ang)

        let rot = -(Link.RAD * ang)
        rot += (rot > 0 && rot < 180) ? -90 : 90

        this.path.attr('d', `M ${lx} ${ly} Q ${xc} ${yc} ${rx} ${ry}`)
        //this.label.attr('x', mx).attr('y', my).attr('transform', `rotate(${rot}, ${mx} ${my})`)

        return this
    }

// Events

    Drag(event) {
        let [x,y] = context.a.Point(event)

        let [left, right]    = this.Ends()
        let [from_x, from_y] = Link.Center(left)
        let [to_x, to_y]     = Link.Center(right)

        let d = (to_x - from_x) * (y - from_y) - (to_y - from_y) * (x - from_x)

        if (d) {
            d = Math.pow(Math.abs(d), 0.5) * ((d > 0) ? -1 : 1)
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
        if (this.jitter >= 3) {
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

