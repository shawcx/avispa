'use strict'

const $        = require('jquery')
const _        = require('underscore')
const Backbone = require('backbone')

const Avispa   = require('@shawcx/avispa')
const Avispa2  = require('@shawcx/avispa/js/Types.js')
console.log(Avispa2)

$(document).ready(function() {
    let graph = new Graph({
        el: $('#surface svg')
    })

    let group = new Group({
        model:    new Backbone.Model({title:'Group 1'}),
        parent:   null,
        position: new Avispa.Position({
            x: -30,
            y: -50,
            w: 150,
            h: 150,
        })
    })

    console.log(Avispa)

    graph.$groups.append(group.$el)

    let n1 = new Avispa.Node({
        label:   'Node 1',
        parent:   group,
        position: new Avispa.Position({
            x: 35,
            y: 55,
            radius: 30,
            fill: '#cfc',
        })
    })

    graph.$objects.append(n1.$el)

    let n2 = new Avispa.Node({
        label:   'Node 2',
        parent:   group,
        position: new Avispa.Position({
            x: 105,
            y: 85,
            radius: 30,
            fill: '#cfc',
        })
    })

    graph.$objects.append(n2.$el)

    group = new Group({
        model:    new Backbone.Model({title:'Group 2'}),
        parent:   null,
        position: new Avispa.Position({
            x: 150,
            y: 60,
            w: 100,
            h: 100,
            fill: '#fcc',
        })
    })

    graph.$groups.append(group.$el)

    let n3 = new Avispa.Node({
        label:   'Node 3',
        parent:   group,
        position: new Avispa.Position({
            x: 25,
            y: 45,
            radius: 30,
        })
    })

    graph.$objects.append(n3.$el)

    let link1 = new Avispa.Link({
        parent: graph,
        left:   n1,
        right:  n3,
    })

    let link2 = new Avispa.Link({
        parent: graph,
        left:   n3,
        right:  n2,
    })
})

class Graph extends Avispa.Avispa {
    initialize(options) {
        super.initialize(options)
    }
}

class Group extends Avispa.Group {
    initialize(options) {
        super.initialize(options)

        this.$label = Avispa.$SVG('text')
            .attr('dx', '0.5em')
            .attr('dy', '1.5em')
            .text(this.model.get('title'))
            .appendTo(this.$el)

        this.render()
    }

    render() {
        super.render()
        this.$label
            .attr('x', this.position.get('x'))
            .attr('y', this.position.get('y'))
        return this
    }

    OnMouseDown(event) {
        super.OnMouseDown(event)
    }

    OnContextMenu(event) {
        if (!event.shiftKey) {
            return Avispa.cancelEvent(event)
        }
    }
}
