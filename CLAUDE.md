# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Avispa is a browser JavaScript library for rendering and interacting with node/link
graphs in SVG. It ships as CommonJS modules under `js/` (entry point `js/Avispa.js`)
plus a companion SCSS/CSS theme under `scss/` and `css/`. It is consumed as an npm
package (`@shawcx/avispa`) and bundled by the host app (the example uses browserify).
There is no build step for the JS itself — consumers bundle `js/` directly.

Runtime dependencies: jQuery, Underscore, Backbone. Classes extend `Backbone.View`
and `Backbone.Model`.

## Commands

There is no test suite and no linter.

- `npm run build` — compile the theme: `scss/Avispa.scss` → `css/Avispa.css` (via `npx sass`).
- `npm run example` — install, build, serve, and open the demo (see below).

### Running the example (`example/`)

`example/` is its own private package. It depends on the repo root directly
(`"@shawcx/avispa": "file:.."`), which npm installs as a symlink — no `npm pack` /
tarball step. From the repo root, `npm run example` runs the whole flow; or inside
`example/`:

- `npm install` — symlinks `node_modules/@shawcx/avispa` → repo root.
- `npm run build` — `build:js` (browserify `src/example.js` → `example.js`) then
  `build:css` (`sass -I ../scss src/example.scss` → `example.css`).
- `npm start` — `npm run build`, then serve on `http://localhost:8000` and open
  `example.html`.
- `npm run serve` — just the static server.

`example.js` and `example.css` are build outputs (git-ignored). Edit `src/example.js`
and `src/example.scss`.

## Architecture

Everything is Backbone MVC: a **`Position` model** (a `Backbone.Model`, see
`js/Types.js`) is the source of truth for each on-screen item, and views bind to its
`change` event and re-render. Moving something means calling `position.set({x, y})`;
rendering is a reaction, never called directly by interaction code.

### The scene and the global context

`js/Context.js` exports a singleton object. `Avispa.initialize` sets `context.a` to
the active `Avispa` instance. Every other module reaches the root view through
`context.a` — for the current `scale`, the in-progress `dragItem`, and coordinate
translation via `context.a.Point(event)`. There is one `Avispa` instance per page.

`Avispa` (`js/Avispa.js`) extends `Backbone.View` and drives the whole surface. It
expects a specific nested `<g>` structure already present in the host's SVG (see
`example/example.html`):

```
g.pan > g.zoom > { g.groups, g.links, g.objects, g.labels }
```

`g.pan` gets a `translate(...)`; `g.zoom` gets a `scale(...)`. `Avispa` owns:
- **Pan** (`Pan`), **zoom/scale** (`Scale`, `Zoom`), middle-click recenter.
- A **global mouse state machine**: `OnMouseDown/Move/Up` dispatch by `event.which`
  (1/2/3). Drag routing is by mutually exclusive state fields — `this.offset` (panning
  the whole scene), `this.arrow` (drawing a new link), `this.dragItem` (an item is
  being dragged). A drag with < 3 `jitter` moves is treated as a click and dispatched
  to the item's `LeftClick`/`MiddleClick`/`RightClick`.
- The `#Arrow` SVG marker referenced by links must be defined in the host's `<defs>`
  (again, see `example/example.html`).

### Items

- **`BaseObject`** (`js/BaseObject.js`) — base for draggable items. Holds a `position`
  model, re-renders on its `change`. Parent/child: a child stores an `offset` relative
  to its parent and follows `parent.position` `change` via `ParentDrag`. `OnMouseDown`
  sets `context.a.dragItem = this`; `Drag` converts client coords through
  `context.a.scale` and writes back to `position`.
- **`Node`** (`js/Node.js`) — `circle` + `text` in a `g.node`. Its `Drag` clamps the
  node inside the parent group's bounds.
- **`Group`** (`js/Group.js`) — `rect` + label in a `g.group`. Its `Drag` can *grow*
  the parent's size when a child is dragged past the edge (`parent.Size(w, h)`).
- **`Link`** (`js/Link.js`) — extends `Backbone.View` directly (not `BaseObject`). An
  SVG `path` (quadratic bézier) between two nodes; re-renders when *either* endpoint's
  `position` changes. Draggable to bend the curve — the bend amount is an `arc` value
  held in its own `Backbone.Model`, and shift-left-click resets it to 0.

### WebSocket transport (`js/Socket.js`)

`Socket` is a plain class (not Backbone) wrapping the browser `WebSocket` with:
reconnect using exponential backoff (`timeout` → doubling → capped at `maxtime`,
retrying indefinitely), a keepalive `ping` interval, an outbound queue that buffers
`send()`/`sendraw()` calls made before the socket is open and flushes them on connect,
`JSON.parse` of inbound frames (bad JSON and `'pong'` frames are dropped, not thrown),
close-code `4004` → `window.location.reload()`, and `close()` to stop reconnecting.
URL is `ws(s)://<host>/<path>` derived from the page, or an explicit `url` option.
Callbacks: `onopen` / `onclose` / `onerror` / `onmessage`.

It is wired into `Avispa` opt-in: pass `socket` to the constructor — a path string
(`new Graph({ el, socket: 'ws' })`) or a `Socket` options object. Inbound messages
are routed to `Avispa.prototype.OnMessage(msg)` (a no-op hook to override in a
subclass) unless the options object supplies its own `onmessage`. `Avispa.remove()`
closes the socket.

### Host integration pattern

Host apps subclass the exported classes (`Avispa`, `Group`, `Node`, `Link`) and
override `initialize` (calling `super`), `render`, `OnMessage`, and the `*Click` /
`OnContextMenu` hooks. `example/src/example.js` is the reference for wiring: construct
items with a `new Avispa.Position({...})`, then `append` their `$el` into the right
layer (`graph.$groups`, `graph.$objects`, etc.). `Avispa.js` re-exports `Position`,
`Group`, `Node`, `Link`, `Socket`, `$SVG`, and `cancelEvent`.

## Known state / gotchas

The `js/` sources are a partial, in-progress port from a single CoffeeScript file
(see history around `098abd1`). The port has not been run end-to-end in a browser, so
treat runtime behavior as unverified. Fixed so far:

- `js/Utils.js` now exports `$SVG` (used by `Node`, `Group`, `Link`, and re-exported
  by `Avispa.js`); the dead local `$SVG`/`normalizeWheel` copies in `Avispa.js` were
  removed in favor of the `Utils.js` versions.
- `Link.render` now builds its `d` attribute with a real template literal, and uses
  `Link.RAD` (was `this.RAD`, which is `undefined` on an instance for a static field).
- `js/Socket.js` was hardened while being integrated: added the pre-open send queue,
  guarded `JSON.parse` / `'pong'` handling, `close()`, capped-and-persistent reconnect
  backoff (previously it gave up permanently once backoff passed `maxtime`), and
  callback hooks. Behavior change: a socket that can't connect now retries forever at
  the `maxtime` interval instead of stopping.
