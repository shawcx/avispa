'use strict'

const _        = require('underscore')
const Backbone = require('backbone')

const { cancelEvent } = require('./Utils.js')
const context         = require('./Context.js')


class BaseObject extends Backbone.View {
    // render once the whole initialize chain has run, so a subclass's own
    // elements exist before its render does
    constructor(options) {
        super(options)
        this.render()
    }

    events() {
        return {
            'pointerdown'  : 'OnMouseDown',
            'pointerenter' : 'OnMouseEnter',
            'pointerleave' : 'OnMouseLeave',
            'pointerup'    : 'OnMouseUp',
            'contextmenu'  : 'OnContextMenu',
            }
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
            this.listenTo(this.parent.position, 'change', this.ParentDrag)
            this.$el.css('display', this.CollapsedAncestor() ? 'none' : '')
        }

        // bound after the initial ParentDrag: a subclass is still building its
        // elements here, and the constructor renders once initialize is done
        if (this.position) {
            this.listenTo(this.position, 'change', this.render)
        }
    }

    // stopListening (in Backbone's remove) drops the model listeners; leaving
    // the parent's children keeps a removed item out of its sizing and collapse
    remove() {
        if (this.parent) {
            this.parent.children = _.without(this.parent.children, this)
        }
        return super.remove()
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

    // how far this item reaches into its parent group, from the parent's top-left
    Extent() {
        return [this.offset.x, this.offset.y]
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
