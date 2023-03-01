'use strict'

const _        = require('underscore')
const Backbone = require('backbone')

const { cancelEvent, $SVG } = require('./Utils.js')
const context               = require('./Context.js')
const BaseObject            = require('./BaseObject.js')


class Node extends BaseObject {
    el() {
        return $SVG('g').attr('class', 'node')
    }

    initialize(options) {
        _.bindAll(this, 'OnMouseDown', 'OnMouseUp', 'OnContextMenu', 'render')

        this.$circle = $SVG('circle')
            .attr('r', options.position.get('radius'))
            .css('fill', options.position.get('fill'))
            .appendTo(this.$el)

        this.$label = $SVG('text')
            .attr('dy', '0.5em')
            .text(options.label)
            .appendTo(this.$el)

        super.initialize(options)

        this.render()
    }

    render() {
        this.$circle
            .attr('cx', this.position.get('x'))
            .attr('cy', this.position.get('y'))
        this.$label
            .attr('x', this.position.get('x'))
            .attr('y', this.position.get('y'))
        return this
    }

    OnMouseEnter(event) {
        if (!context.a.dragItem) {
            this.$circle.attr('class', 'hover')
        }
        return cancelEvent(event)
    }

    OnMouseLeave(event) {
        if (!context.a.dragItem) {
            this.$circle.removeAttr('class')
        }
        return cancelEvent(event)
    }

    Drag(event) {
        let x = (event.clientX / context.a.scale) - this.x1
        let y = (event.clientY / context.a.scale) - this.y1

        if (this.offset) {
            this.offset.x = this.ox1 + x
            this.offset.y = this.oy1 + y

            if (this.offset.x < 0) {
                this.offset.x = 0
                x = this.parent.position.get('x')
            }
            else if (this.offset.x > this.parent.position.get('w')) {
                this.offset.x = this.parent.position.get('w')
                x = this.parent.position.get('x') + this.parent.position.get('w')
            }
            if (this.offset.y < 0) {
                this.offset.y = 0
                y = this.parent.position.get('y')
            }
            else if (this.offset.y > this.parent.position.get('h')) {
                this.offset.y = this.parent.position.get('h')
                y = this.parent.position.get('y') + this.parent.position.get('h')
            }
        }

        this.position.set({x:x,y:y})

        return cancelEvent(event)
    }
}

module.exports = Node
