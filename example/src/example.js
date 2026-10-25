'use strict'

const $        = require('jquery')
const _        = require('underscore')
const Backbone = require('backbone')

const Avispa   = require('@shawcx/avispa')

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
            w: 200,
            h: 150,
            fill: '#fcc',
        })
    })

    graph.$groups.append(group.$el)

    let n3 = new Avispa.Node({
        label:   'Node 3',
        parent:   group,
        position: new Avispa.Position({
            x: 25,
            y: 60,
            radius: 30,
        })
    })

    graph.$objects.append(n3.$el)

    // a group nested inside Group 2
    let nested = new Group({
        model:    new Backbone.Model({title:'Group 3'}),
        parent:   group,
        position: new Avispa.Position({
            x: 90,
            y: 40,
            w: 90,
            h: 90,
            fill: '#ccf',
        })
    })

    graph.$groups.append(nested.$el)

    let n4 = new Avispa.Node({
        label:   'Node 4',
        parent:   nested,
        position: new Avispa.Position({
            x: 45,
            y: 55,
            radius: 30,
        })
    })

    graph.$objects.append(n4.$el)

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

    let link3 = new Avispa.Link({
        parent: graph,
        left:   n2,
        right:  n4,
    })

    let link4 = new Avispa.Link({
        parent: graph,
        left:   n3,
        right:  n4,
    })

    // for poking at from the console, and for the tests
    window.example = { graph, n1, n2, n3, n4, link1, link2, link3, link4 }
})

class Graph extends Avispa.Avispa {
    initialize(options) {
        super.initialize(options)
    }
}

class Group extends Avispa.Group {
    events() {
        return Object.assign(super.events(), {
            'dblclick text' : 'OnTitleDoubleClick',
            })
    }

    initialize(options) {
        super.initialize(options)

        this.$label = Avispa.$SVG('text')
            .attr('dx', '0.5em')
            .attr('dy', '1.5em')
            .text(this.model.get('title'))
            .appendTo(this.$el)
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

    OnTitleDoubleClick(event) {
        this.ToggleCollapse()
        return Avispa.cancelEvent(event)
    }

    OnContextMenu(event) {
        if (!event.shiftKey) {
            return Avispa.cancelEvent(event)
        }
    }
}
