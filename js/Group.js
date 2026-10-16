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

        this.position.bind('change:collapsed', this.UpdateVisibility, this)
    }

    render() {
        this.$rect
            .attr('width',  this.position.get('w'))
            .attr('height', this.Height())
            .attr('x',      this.position.get('x'))
            .attr('y',      this.position.get('y'))
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
