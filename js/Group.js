'use strict'

const _        = require('underscore')
const Backbone = require('backbone')

const { cancelEvent, $SVG } = require('./Utils.js')
const context               = require('./Context.js')
const BaseObject            = require('./BaseObject.js')


class Group extends BaseObject {
    el() {
        return $SVG('g').attr('class', 'group')
    }

    initialize(options) {
        this.$rect = $SVG('rect')
            .attr('width',  options.position.get('w'))
            .attr('height', options.position.get('h'))
            .css('fill', options.position.get('fill'))
            .appendTo(this.$el)

        super.initialize(options)
    }

    render() {
        this.$rect
            .attr('width',  this.position.get('w'))
            .attr('height', this.position.get('h'))
            .attr('x',      this.position.get('x'))
            .attr('y',      this.position.get('y'))
        return this
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
            let boundsy = this.parent.position.get('h') - this.position.get('h') - 10

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
