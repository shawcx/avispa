'use strict'

const _        = require('underscore')
const Backbone = require('backbone')

const { cancelEvent, $SVG } = require('./Utils.js')
const context               = require('./Context.js')
const BaseObject            = require('./BaseObject.js')


class Group extends BaseObject {
    // a collapsed group shrinks to its title bar: the 30px a child group keeps
    // clear at the top in Drag
    static COLLAPSED_HEIGHT = 30

    // the resize handle in the bottom-right corner, and the smallest a group gets
    static HANDLE   = 10
    static MIN_SIZE = 40

    el() {
        return $SVG('g').attr('class', 'group')
    }

    events() {
        return Object.assign(super.events(), {
            'pointerdown rect.handle' : 'OnHandleDown',
            })
    }

    initialize(options) {
        this.$rect = $SVG('rect')
            .attr('width',  options.position.get('w'))
            .attr('height', options.position.get('h'))
            .css('fill', options.position.get('fill'))
            .appendTo(this.$el)

        this.$handle = $SVG('rect')
            .attr('class',  'handle')
            .attr('width',  Group.HANDLE)
            .attr('height', Group.HANDLE)
            .appendTo(this.$el)

        super.initialize(options)

        this.listenTo(this.position, 'change:collapsed', this.UpdateVisibility)
    }

    render() {
        let x = this.position.get('x')
        let y = this.position.get('y')
        let w = this.position.get('w')
        let h = this.Height()

        this.$rect
            .attr('width',  w)
            .attr('height', h)
            .attr('x',      x)
            .attr('y',      y)

        // no resizing while collapsed
        this.$handle
            .attr('x', x + w - Group.HANDLE)
            .attr('y', y + h - Group.HANDLE)
            .css('display', this.position.get('collapsed') ? 'none' : '')

        return this
    }

    // drawn height; `h` keeps the expanded height while collapsed
    Height() {
        return this.position.get('collapsed') ? Group.COLLAPSED_HEIGHT : this.position.get('h')
    }

    Collapse() {
        this.position.set({collapsed: true})
        return this
    }

    Expand() {
        this.position.set({collapsed: false})
        return this
    }

    ToggleCollapse() {
        this.position.set({collapsed: !this.position.get('collapsed')})
        return this
    }

    // set the size, but no smaller than the group's contents, and grow the
    // parent group if this one no longer fits inside it
    Resize(w, h) {
        let [minw, minh] = this.MinSize()
        this.Size(Math.max(w, minw), Math.max(h, minh))

        if (this.parent) {
            let [pw, ph] = this.Extent()
            this.parent.Resize(
                Math.max(this.parent.position.get('w'), pw),
                Math.max(this.parent.position.get('h'), ph))
        }
        return this
    }

    // the smallest size that still holds every child
    MinSize() {
        let w = Group.MIN_SIZE
        let h = Group.MIN_SIZE
        for (const child of this.children) {
            let [cw, ch] = child.Extent()
            w = Math.max(w, cw)
            h = Math.max(h, ch)
        }
        return [w, h]
    }

    // the room this group needs inside its parent, keeping the 10px margin of Drag
    Extent() {
        return [
            this.offset.x + this.position.get('w') + 10,
            this.offset.y + this.Height() + 10,
            ]
    }

    // dragging the handle resizes the group, through a drag item of its own so
    // the group's click hooks don't fire for it
    OnHandleDown(event) {
        let start = {
            x: event.clientX,
            y: event.clientY,
            w: this.position.get('w'),
            h: this.position.get('h'),
            }

        context.a.dragItem = {
            jitter: 0,
            Drag: (event) => this.Resize(
                start.w + (event.clientX - start.x) / context.a.scale,
                start.h + (event.clientY - start.y) / context.a.scale),
            }

        return cancelEvent(event)
    }

    OnMouseEnter(event) {
        if (!context.a.dragItem) {
            this.$rect.attr('class', 'hover')
        }
        return cancelEvent(event)
    }

    OnMouseLeave(event) {
        if (!context.a.dragItem) {
            this.$rect.removeAttr('class')
        }
        return cancelEvent(event)
    }

    Drag(event) {
        let x = (event.clientX / context.a.scale) - this.x1
        let y = (event.clientY / context.a.scale) - this.y1

        let newparentw = 0
        let newparenth = 0

        if (this.offset) {
            this.offset.x = this.ox1 + x
            this.offset.y = this.oy1 + y

            let boundsx = this.parent.position.get('w') - this.position.get('w') - 10
            let boundsy = this.parent.position.get('h') - this.Height() - 10

            if (this.offset.x < 10) {
                this.offset.x = 10
                x = this.parent.position.get('x') + 10
            }
            else if (this.offset.x > boundsx) {
                //this.offset.x = boundsx
                //x = this.parent.position.get('x') + boundsx
                newparentw = this.offset.x - boundsx
                x = this.offset.x //this.parent.position.get('x') + boundsx
            }

            if (this.offset.y < 30) {
                this.offset.y = 30
                y = this.parent.position.get('y') + 30
            }
            else if (this.offset.y > boundsy) {
                //this.offset.y = boundsy
                //y = this.parent.position.get('y') + boundsy
                newparenth = this.offset.y - boundsy
                y = this.offset.y //this.parent.position.get('x') + boundsx
            }
        }

        this.position.set({x:x,y:y})
        if (newparentw || newparenth) {
            newparentw = this.parent.position.get('w') + newparentw
            newparenth = this.parent.position.get('h') + newparenth
            this.parent.Size(newparentw, newparenth)
        }

        return cancelEvent(event)
    }
}

module.exports = Group
