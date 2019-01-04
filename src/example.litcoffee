
    $(document).ready () ->
        graph = new Graph
            el: $('#surface svg')

        group = new Group
            model:    new Backbone.Model(title:'Group 1')
            parent:   null
            position: new Backbone.Model
                x: -30
                y: -50
                w: 150
                h: 150

        graph.$groups.append(group.$el)

        n1 = new Avispa.Node
            label:   'Node 1'
            parent:   group
            position: new Backbone.Model
                x: 35
                y: 55
                radius: 30
                fill: '#cfc'

        graph.$objects.append(n1.$el)

        n2 = new Avispa.Node
            label:   'Node 2'
            parent:   group
            position: new Backbone.Model
                x: 105
                y: 85
                radius: 30
                fill: '#cfc'

        graph.$objects.append(n2.$el)

        group = new Group
            model:    new Backbone.Model(title:'Group 2')
            parent:   null
            position: new Backbone.Model
                x: 150
                y: 60
                w: 100
                h: 100
                fill: '#fcc'

        graph.$groups.append(group.$el)

        n3 = new Avispa.Node
            label:   'Node 3'
            parent:   group
            position: new Backbone.Model
                x: 25
                y: 45
                radius: 30

        graph.$objects.append(n3.$el)

        link = new Avispa.Link
            parent: graph
            left:   n1
            right:  n3

        link = new Avispa.Link
            parent: graph
            left:   n3
            right:  n2


    class Graph extends Avispa
        initialize: () ->
            super()

    class Group extends Avispa.Group
        initialize: () ->
            super()

            @$label = $SVG('text')
                .attr('dx', '0.5em')
                .attr('dy', '1.5em')
                .text(@model.get('title'))
                .appendTo(@$el)

            @render()

            return @

        render: () ->
            super()

            @$label
                .attr('x', @position.get('x'))
                .attr('y', @position.get('y'))

            return @

        OnMouseDown: (event) ->
            super()

Push to the database the position that we stop dragging at.

        OnContextMenu: (event) ->
            return if event.shiftKey
            cancelEvent(event)
