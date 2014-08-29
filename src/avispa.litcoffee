    ###
    (c) 2013-2014 Matthew Oertle <moertle@gmail.com>
    ###


A wrapper function to create jQuery SVG elements

    window.$SVG ?= (name) -> $( document.createElementNS('http://www.w3.org/2000/svg', name) )

Cancel an event

    window.cancelEvent ?= (event) ->
        event.preventDefault()
        event.stopPropagation()
        return false

Standardize the way scrolling the mousewheel is handled across browsers

    jQuery.event.props.push('wheelDelta')
    jQuery.event.props.push('detail')

    window.normalizeWheel ?= (event) ->
        return event.wheelDelta / 120 if event.wheelDelta
        return event.detail     /  -3 if event.detail
        return 0

Constants

    RAD = 180.0 / Math.PI


The template for the main surface.

    avispa_main = '''
        <defs>
         <marker id="Arrow"
           viewBox="0 0 10 10" refX="7" refY="5"
           markerUnits="strokeWidth"
           markerWidth="4" markerHeight="4"
           fill="#eee" stroke="#999" stroke-width="1px" stroke-dasharray="10,0"
           orient="auto">
          <path d="M 1 1 L 9 5 L 1 9 z" />
         </marker>
        </defs>
        <g class="pan">
         <g class="zoom">
          <g class="links"></g>
          <g class="nodes"></g>
          <g class="labels"></g>
         </g>
        </g>
        '''

    context = null


Expose a global view class so that consumers of the API can instantiate a view.

    class window.Avispa extends Backbone.View

        @VERSION: '0.2'

        events:
            'mousedown.avispa'      : 'OnMouseDown'
            'mousemove.avispa'      : 'OnMouseMove'
            'mouseup.avispa'        : 'OnMouseUp'
            'mousewheel.avispa'     : 'OnMouseWheel'
            'DOMMouseScroll.avispa' : 'OnMouseWheel'
            'contextmenu.avispa'    : 'OnContextMenu'

        initialize: (options) ->
            context = @

            _.bindAll @, 'render',
                'OnMouseDown', 'OnMouseMove', 'OnMouseUp', 'OnMouseWheel', 'OnContextMenu'

            @scale    = 1.0
            @links    = {}
            @offset   = null
            @dragItem = null
            @arrow    = null

            @position =
                x: 0
                y: 0

            @zoom =
                step : 0.125
                min  : 0.125
                max  : 2.5

            @$parent  = @$el.parent()

            @$pan     = @$el.find('g.pan')
            @$zoom    = @$el.find('g.zoom')

            @$groups  = @$el.find('g.groups')
            @$links   = @$el.find('g.links')
            @$objects = @$el.find('g.objects')
            @$labels  = @$el.find('g.labels')

            @$pan.x = parseInt(window.innerWidth  / 2)
            @$pan.y = parseInt(window.innerHeight / 2)

            @Pan(0,0)

            return @

        Pan: (dx, dy) ->
            @$pan.x += dx
            @$pan.y += dy

            @$pan.attr('transform', "translate(#{@$pan.x}, #{@$pan.y})")
            @$parent.css('background-position', "#{@$pan.x}px #{@$pan.y}px")
            return @

        Scale: (@scale) ->
            @$zoom.attr('transform', "scale(#{scale})")
            return @

        Zoom: (delta) ->
            if delta is 0 then scale = 1.0
            else scale = @scale + delta * @zoom.step

            return @ if scale <= @zoom.min or scale >= @zoom.max

            @Scale(scale)
            return @

        Point: (event) ->
            # translates the client x,y into the surface x,y
            point = @el.createSVGPoint()
            point.x = event.clientX
            point.y = event.clientY
            point = point.matrixTransform(@el.getScreenCTM().inverse())

            # account for the current pan and scale
            point.x = parseInt((point.x - @$pan.x) / @scale)
            point.y = parseInt((point.y - @$pan.y) / @scale)

            return [point.x, point.y]

        OnMouseDown: (event) ->
            if @arrow?
                @arrow.Remove()
                @arrow = null
                return cancelEvent(event)

            switch event.which
                when 1 then @LeftDown(event)
                when 2 then @MiddleDown(event)
                when 3 then @RightDown(event) if @RightDown

            return cancelEvent(event)

        LeftDown: (event) ->
            #if event.shiftKey
            @offset = [event.clientX, event.clientY]
            return

        MiddleDown: (event) ->
            @Pan(-@$pan.x + window.innerWidth / 2, -@$pan.y + window.innerHeight / 2)
            @Zoom(0)
            #@$('#zoomslider').slider('option', 'value', 1)
            return

        OnMouseMove: (event) ->
            # drag the entire scene around
            if @offset
                @Pan(event.clientX - @offset[0], event.clientY - @offset[1])
                @offset = [event.clientX, event.clientY]

            else if @arrow
                @arrow.Drag(event)

            else if @dragItem
                @dragItem.jitter++
                @dragItem.Drag(event) if @dragItem.Drag

            return cancelEvent(event)

        OnMouseUp: (event) ->
            @offset = null

            if @dragItem?
                if @dragItem.jitter < 3
                    switch event.which
                        when 1 then @dragItem.LeftClick(event)   if @dragItem.LeftClick
                        when 2 then @dragItem.MiddleClick(event) if @dragItem.MiddleClick
                        when 3 then @dragItem.RightClick(event)  if @dragItem.RightClick

                @dragItem.MouseUp(event) if @dragItem?.MouseUp
                @dragItem = null

            else
                switch event.which
                    when 1 then @LeftClick(event)   if @LeftClick
                    when 2 then @MiddleClick(event) if @MiddleClick
                    when 3 then @RightClick(event)  if @RightClick

            return cancelEvent(event)

        OnMouseWheel: (event) ->
            @Zoom(normalizeWheel(event))
            #@$('#zoomslider').slider('option', 'value', @scale)
            return cancelEvent(event)

        OnContextMenu: (event) ->


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



Base class for "group" objects

    class Avispa.Group extends Avispa.BaseObject
        el: () -> $SVG('g').attr('class', 'group')

        initialize: () ->
            super

            @$rect = $SVG('rect')
                .attr('width',  @position.get('w'))
                .attr('height', @position.get('h'))
                .css('fill', @position.get('fill'))
                .appendTo(@$el)

            return

        render: () ->
            @$rect
                .attr('x', @position.get('x'))
                .attr('y', @position.get('y'))
            return @

        OnMouseEnter: (event) ->
            if not context.dragItem?
                @$rect.attr('class', 'hover')
            return cancelEvent(event)

        OnMouseLeave: (event) ->
            if not context.dragItem?
                @$rect.removeAttr('class')
            return cancelEvent(event)


        Drag: (event) ->
            x = (event.clientX / context.scale) - @x1
            y = (event.clientY / context.scale) - @y1

            if @offset
                @offset.x = @ox1 + x
                @offset.y = @oy1 + y

                boundsx = @parent.position.get('w') - @position.get('w') - 10
                boundsy = @parent.position.get('h') - @position.get('h') - 10

                if @offset.x < 10
                    @offset.x = 10
                    x = @parent.position.get('x') + 10
                else if @offset.x > boundsx
                    @offset.x = boundsx
                    x = @parent.position.get('x') + boundsx
                if @offset.y < 10
                    @offset.y = 10
                    y = @parent.position.get('y') + 10
                else if @offset.y > boundsy
                    @offset.y = boundsy
                    y = @parent.position.get('y') + boundsy

            @position.set 'x': x, 'y': y

            return cancelEvent(event)



Base class for "node" objects

    class Avispa.Node extends Avispa.BaseObject
        el: () -> $SVG('g').attr('class', 'node')

        initialize: () ->
            super

            @$circle = $SVG('circle')
                .attr('r', @position.get('radius'))
                .css('fill', @position.get('fill'))
                .appendTo(@$el)

            @$label = $SVG('text')
                .attr('dy', '0.5em')
                .text(@options.label)
                .appendTo(@$el)

            @render()

            return

        render: () ->
            @$circle
                .attr('cx', @position.get('x'))
                .attr('cy', @position.get('y'))

            @$label
                .attr('x', @position.get('x'))
                .attr('y', @position.get('y'))

            return @

        OnMouseEnter: (event) ->
            if not context.dragItem?
                @$circle.attr('class', 'hover')
            return cancelEvent(event)

        OnMouseLeave: (event) ->
            if not context.dragItem?
                @$circle.removeAttr('class')
            return cancelEvent(event)


        Drag: (event) ->
            x = (event.clientX / context.scale) - @x1
            y = (event.clientY / context.scale) - @y1

            if @offset
                @offset.x = @ox1 + x
                @offset.y = @oy1 + y

                if @offset.x < 0
                    @offset.x = 0
                    x = @parent.position.get('x')
                else if @offset.x > @parent.position.get('w')
                    @offset.x = @parent.position.get('w')
                    x = @parent.position.get('x') + @parent.position.get('w')
                if @offset.y < 0
                    @offset.y = 0
                    y = @parent.position.get('y')
                else if @offset.y > @parent.position.get('h')
                    @offset.y = @parent.position.get('h')
                    y = @parent.position.get('y') + @parent.position.get('h')

            @position.set 'x': x, 'y': y

            return cancelEvent(event)



Base class for "link" objects

    #Link = Backbone.View.extend
    #    className: 'link'
    #    initialize: () ->

    class Avispa.Link extends Backbone.View
        el: () -> $SVG('g').attr('class', 'link')

        events:
            'mousedown'   : 'OnMouseDown'
            'mouseenter'  : 'OnMouseEnter'
            'mouseleave'  : 'OnMouseLeave'
            'contextmenu' : 'OnContextMenu'

        initialize: (@options) ->
            @path = $SVG('path')
                .css('marker-end', 'url(#Arrow)')
                .css('opacity', '0.5')
                .appendTo(@$el)

            _.bindAll @,
                'render',
                'OnMouseDown', 'OnMouseEnter', 'OnMouseLeave', 'OnContextMenu'

            @left  = @options.left
            @right = @options.right

            @arc = new Backbone.Model
                arc: 10

            @arc.bind 'change', @render, @

Bind to the position of the left and right sides of the connection

            @left.position.bind  'change', @render, @
            @right.position.bind 'change', @render, @

            @render()

            return @

        update: () ->
            #@label.text(name)
            return

        render: () ->
            return @ if not @arc

            arc = @arc.get('arc')
            lx = @left.position.get('x')
            ly = @left.position.get('y')
            rx = @right.position.get('x')
            ry = @right.position.get('y')

            # calculate the angle between 2 nodes
            ang = Math.atan2(rx - lx, ry - ly)

            # bound the offset to about half the circle
            offset = Math.max(-1.5, Math.min(1.5, arc / 100))

            # draw to the edge of the node
            lx +=  30 * Math.sin(ang + offset)
            ly +=  30 * Math.cos(ang + offset)
            rx += -33 * Math.sin(ang - offset)
            ry += -33 * Math.cos(ang - offset)

            # calculate the the position for the quadratic bezier curve
            xc = ((lx + rx) >> 1) + arc * Math.cos(ang)
            yc = ((ly + ry) >> 1) - arc * Math.sin(ang)

            mx = xc - (arc>>1) * Math.cos(ang)
            my = yc + (arc>>1) * Math.sin(ang)

            rot = -(RAD * ang)
            if rot > 0 and rot < 180
            then rot -= 90
            else rot += 90

            @path.attr('d', "M #{lx} #{ly} Q #{xc} #{yc} #{rx} #{ry}")
            #@label.attr('x', mx).attr('y', my).attr('transform', "rotate(#{rot}, #{mx} #{my})")

            return @

Events

        Drag: (event) ->
            [x,y] = context.Point(event)

            from_x = @left.position.get('x')
            from_y = @left.position.get('y')
            to_x   = @right.position.get('x')
            to_y   = @right.position.get('y')

            d = (to_x - from_x) * (y - from_y) - (to_y - from_y) * (x - from_x)

            if d
                d = Math.pow(Math.abs(d), 0.5) * if d > 0 then -1 else 1

            if not @od and @od isnt 0
                @od = d

            # will trigger a call to render
            @arc.set('arc', Math.max(10, @oarc + d - @od))

            return

        OnMouseDown: (event) ->
            @jitter = 0

            context.dragItem = @
            @oarc = @arc.get('arc')
            @od = null

            return cancelEvent(event)

        MouseUp: (event) ->
            if @jitter > 3
                @path.css('stroke-width', '3px')

            return

        OnMouseEnter: () ->
            if not context.dragItem?
                @path.css('stroke-width', '6px')
            return

        OnMouseLeave: () ->
            if not context.dragItem?
                @path.css('stroke-width', '3px')
            return

        LeftClick: (event) ->
            @arc.set('arc', 0) if event.shiftKey
            return

        OnContextMenu: (event) ->
