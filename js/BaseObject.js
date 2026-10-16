'use strict'

const _        = require('underscore')
const Backbone = require('backbone')

const { cancelEvent } = require('./Utils.js')
const context         = require('./Context.js')


class BaseObject extends Backbone.View {
    events() {
        return {
            'mousedown'   : 'OnMouseDown',
            'mouseenter'  : 'OnMouseEnter',
            'mouseleave'  : 'OnMouseLeave',
            'mouseup'     : 'OnMouseUp',
            'contextmenu' : 'OnContextMenu',
            }
    }

    delegateEvents(events) {
        super.delegateEvents(events)
    }

    initialize(options) {
        _.bindAll(this, 'OnMouseDown', 'OnMouseUp', 'OnContextMenu', 'render')

        this.parent   = options.parent
        this.children = []
        this.position = options.position

        if (this.parent) {
            this.parent.children.push(this)
            this.offset = {
                x: this.position.get('x'),
                y: this.position.get('y'),
                }
            this.ParentDrag(this.parent.position)
            this.parent.position.bind('change', this.ParentDrag, this)
            this.$el.css('display', this.CollapsedAncestor() ? 'none' : '')
        }

        // bound after the initial ParentDrag: a subclass is still building its
        // elements here, and renders itself once its own initialize is done
        if (this.position) {
            this.position.bind('change', this.render, this)
        }
    }

    // the outermost collapsed group containing this item, or null if it is on screen
    CollapsedAncestor() {
        let collapsed = null
        for (let p = this.parent; p; p = p.parent) {
            if (p.position.get('collapsed')) {
                collapsed = p
            }
        }
        return collapsed
    }

    // hide everything inside a collapsed group, and show it again on expand
    UpdateVisibility() {
        for (const child of this.children) {
            child.$el.css('display', child.CollapsedAncestor() ? 'none' : '')
            child.UpdateVisibility()
        }
    }

    Size(w,h) {
        this.position.set({w:w,h:h})
        return this
    }

    ParentDrag(parentPosition) {
        this.position.set({
            x: this.offset.x + parentPosition.get('x'),
            y: this.offset.y + parentPosition.get('y'),
            })
    }

    OnMouseDown(event) {
        this.jitter = 0

        this.x1 = (event.clientX / context.a.scale) - this.position.get('x')
        this.y1 = (event.clientY / context.a.scale) - this.position.get('y')

        if (this.parent) {
            this.ox1 = this.offset.x - this.position.get('x')
            this.oy1 = this.offset.y - this.position.get('y')
        }

        // TODO: calculate the bounds of the parent element

        if (event.shiftKey) {
            this.$el.parent().append(this.$el)
        }

        context.a.dragItem = this

        return cancelEvent(event)
    }

    Drag(event) {
        let x = (event.clientX / context.a.scale) - this.x1
        let y = (event.clientY / context.a.scale) - this.y1
        this.position.set({x:x,y:y})
        return cancelEvent(event)
    }

    OnMouseUp(event) {}
    OnContextMenu(event) {}
    LeftClick(event) {}
    MiddleClick(event) {}
    RightClick(event) {}
}

module.exports = BaseObject
