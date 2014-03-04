
The Avispa.BaseObject represents an abstract base class for Group and Node
elements.  The root is an SVG G element that is translated when dragged.

    Avispa.BaseObject = Backbone.View.extend

        events:
            'mousedown'   : 'OnMouseDown'
            'mouseenter'  : 'OnMouseEnter'
            'mouseleave'  : 'OnMouseLeave'
            'mouseup'     : 'OnMouseUp'
            'contextmenu' : 'OnContextMenu'

The "Position" model is defined by the project that is importing Avispa.

        initialize: (@options) ->
            _.bindAll @, 'OnMouseDown', 'OnMouseUp', 'OnContextMenu'

Expect a position to be passed in

            @position = @options.position
            @parent   = @options.parent

If we have a parent, keep track of our offset from the parent

            if @parent
                @offset =
                    x: @position.get('x')
                    y: @position.get('y')
                @ParentDrag(@parent.position)
                @parent.position.bind 'change', @ParentDrag, @

            @position.bind 'change', @render, @

The init method allows classes to extend the BaseObject without re-implementing this initialize function

            @_init()
            @init?()

            @render()
            return @

        ParentDrag: (ppos) ->
            @position.set
                x: @offset.x + ppos.get('x')
                y: @offset.y + ppos.get('y')
            return

        OnMouseDown: (event) ->
            @jitter = 0

            @x1 = (event.clientX / context.scale) - @position.get('x')
            @y1 = (event.clientY / context.scale) - @position.get('y')

            if @parent
                @ox1 = @offset.x - @position.get('x')
                @oy1 = @offset.y - @position.get('y')

            # TODO: calculate the bounds of the parent element

            if event.shiftKey
                @$el.parent().append(@$el)

            context.dragItem = @

            return cancelEvent(event)

        Drag: (event) ->
            x = (event.clientX / context.scale) - @x1
            y = (event.clientY / context.scale) - @y1

            @position.set 'x': x, 'y': y

            return cancelEvent(event)

        OnMouseUp: (event) ->

        OnContextMenu: (event) ->
