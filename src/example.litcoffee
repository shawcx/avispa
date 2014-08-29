
    $(document).ready () ->
        graph = new Graph
            el: $('#surface svg')

        group = new ForemanGroup
            model:    new Backbone.Model(title:'Group 1')
            parent:   null
            position: new Backbone.Model
                x: 30
                y: -50
                w: 100
                h: 100
                fill: '#fcc'

        graph.$groups.append(group.$el)

        group = new ForemanGroup
            model:    new Backbone.Model(title:'Group 2')
            parent:   null
            position: new Backbone.Model
                x: 40
                y: 60
                w: 100
                h: 100
                fill: '#fcc'

        graph.$groups.append(group.$el)


    class Graph extends Avispa
        initialize: () ->
            super

    class ForemanGroup extends Avispa.Group
        initialize: () ->
            super

            @$label = $SVG('text')
                .attr('dx', '0.5em')
                .attr('dy', '1.5em')
                .text(@model.get('title'))
                .appendTo(@$el)

            @render()

            return @

        render: () ->
            @$rect
                .attr('x', @position.get('x'))
                .attr('y', @position.get('y'))
            @$label
                .attr('x', @position.get('x'))
                .attr('y', @position.get('y'))
            return @

        OnMouseDown: (event) ->
            $('.contextMenu').hide()
            super

Push to the database the position that we stop dragging at.

        OnContextMenu: (event) ->
            return if event.shiftKey
            cancelEvent(event)
