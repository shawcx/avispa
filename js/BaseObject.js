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
        this.position = options.position
        if (this.position) {
            this.position.bind('change', this.render, this)
        }

        if (this.parent) {
            this.offset = {
                x: this.position.get('x'),
                y: this.position.get('y'),
                }
            this.ParentDrag(this.parent.position)
            this.parent.position.bind('change', this.ParentDrag, this)
        }
    }

    size(w,h) {
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
