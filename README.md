Avispa
======

Draw node/link graphs in SVG and interact with them: drag nodes and groups, pan,
zoom, bend links, and resize, nest, and collapse groups, with mouse, pen, or touch.
Items are Backbone views, and an optional WebSocket feed keeps a graph live.

Avispa is Spanish for wasp.

Demo at [https://shawcx.github.io/avispa/](https://shawcx.github.io/avispa/)

Install
-------

```sh
npm install @shawcx/avispa jquery underscore backbone
```

jQuery (3 or 4), Underscore, and Backbone are peer dependencies, so your app
supplies one copy of each. The library is CommonJS (`js/Avispa.js`), meant to be
bundled with browserify, webpack, esbuild, or similar. The theme is
`css/Avispa.css`, or `@use` `scss/Avispa.scss` from your own Sass.

Page setup
----------

Avispa draws into an SVG on your page, which needs these layers, and an `#Arrow`
marker for the link arrowheads:

```html
<svg class="avispa">
  <defs>
    <marker id="Arrow" viewBox="0 0 10 10" refX="7" refY="5"
            markerWidth="4" markerHeight="4" orient="auto">
      <path d="M 1 1 L 9 5 L 1 9 z" />
    </marker>
  </defs>
  <g class="pan">
    <g class="zoom">
      <g class="groups"></g>
      <g class="links"></g>
      <g class="objects"></g>
      <g class="labels"></g>
    </g>
  </g>
</svg>
```

Usage
-----

Each item takes a `Position` model; moving an item means setting its position, and
the view redraws. A child's `x` and `y` are relative to its parent group.

```js
const $      = require('jquery')
const Avispa = require('@shawcx/avispa')

$(() => {
    const graph = new Avispa.Avispa({ el: $('svg.avispa') })

    const group = new Avispa.Group({
        position: new Avispa.Position({ x: -200, y: -75, w: 200, h: 150 }),
    })
    graph.$groups.append(group.$el)

    const a = new Avispa.Node({
        label:    'A',
        parent:   group,
        position: new Avispa.Position({ x: 60, y: 75, radius: 30 }),
    })
    const b = new Avispa.Node({
        label:    'B',
        position: new Avispa.Position({ x: 150, y: 0, radius: 30 }),
    })
    graph.$objects.append(a.$el, b.$el)

    new Avispa.Link({ parent: graph, left: a, right: b })

    // a.position.set({ x: 80 }) moves A and its link
})
```

On screen:

- Drag the background to pan, scroll or pinch to zoom in on the spot under the
  pointer or between your fingers, and middle-click to recenter.
- Drag a node or group to move it; a group's children come along. A node stays
  inside its group, and a nested group dragged past its parent's edge grows it.
- Drag a group's bottom-right corner to resize it, down to what its contents need.
- Drag a link to bend it; shift-click it to straighten it.

In code, `group.Collapse()`, `Expand()`, and `ToggleCollapse()` shrink a group to
its title bar and hide what's inside, and `item.remove()` takes an item off the
graph (remove its links yourself).

To customize, subclass `Avispa`, `Group`, `Node`, and `Link`, and override
`initialize` (calling `super`), `render`, and the `LeftClick`, `MiddleClick`,
`RightClick`, and `OnContextMenu` hooks. [`example/src/example.js`](example/src/example.js)
does this, adding a title to each group that collapses it on double-click.

### WebSocket

```js
class Graph extends Avispa.Avispa {
    OnMessage(msg) {
        // each JSON message from ws(s)://<page host>/ws
    }
}

const graph = new Graph({ el: $('svg.avispa'), socket: 'ws' })
graph.socket.send({ hello: 'world' })
```

The socket reconnects with backoff, keeps the connection alive with pings, and
queues anything sent before it opens. Pass an options object instead of a path
for an explicit `url` or your own `onopen` / `onclose` / `onmessage` callbacks.

Development
-----------

- `npm run example` builds the demo in `example/` and opens it in a browser.
- `npm test` runs the Playwright tests in Google Chrome, and `npm run lint` runs ESLint.
- `npm run build` compiles `scss/Avispa.scss` to `css/Avispa.css`.
- To release, bump the version in `package.json` and push a matching `vX.Y.Z` tag;
  CI publishes it to npm and creates the GitHub release.
