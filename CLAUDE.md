# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Avispa is a browser JavaScript library for rendering and interacting with node/link
graphs in SVG. It ships as CommonJS modules under `js/` (entry point `js/Avispa.js`)
plus a companion SCSS/CSS theme under `scss/` and `css/`. It is consumed as an npm
package (`@shawcx/avispa`) and bundled by the host app (the example uses browserify).
There is no build step for the JS itself — consumers bundle `js/` directly.

Runtime dependencies: jQuery, Underscore, Backbone — `peerDependencies`, so the host
supplies one copy of each (also `devDependencies` here, for the example and tests).
Classes extend `Backbone.View` and `Backbone.Model`. The published package is just
`js/`, `css/`, and `scss/` (the `files` field). `.github/dependabot.yml` opens weekly
update PRs for npm (root and `example/`) and GitHub Actions.

## Commands

There is no linter.

- `npm run build` — compile the theme: `scss/Avispa.scss` → `css/Avispa.css` (via `npx sass`).
- `npm run example` — install, build, serve, and open the demo (see below).
- `npm run publish:skunk` — publish to the npm registry of `nodejs/avispa` (project 69)
  on code.skunk.tools; the token comes from `glab` into `SKUNK_NPM_TOKEN`, which
  `.npmrc` reads. npm forwarding is off on the `nodejs` group, otherwise npm sees the
  npmjs versions and refuses. Plain `npm publish` still goes to npmjs.
- `npm test` — Playwright tests, also run by GitHub Actions (`.github/workflows/test.yml`)
  on pushes to `main` and on PRs. `test/example.spec.js` drives the example with real
  pointer, wheel, and touch input. `test/socket.spec.js` injects `js/Socket.js` into a
  page (it has no requires), stands in for the server with `page.routeWebSocket`
  (unrouted connections are refused by the static server, like a server that is
  down), and drives reconnect/keepalive timers with a paused `page.clock` — an
  installed clock otherwise keeps pace with real time. `pretest` installs and builds `example/`;
  `playwright.config.js` serves it on port 8123 and runs the installed Google Chrome
  (`channel: 'chrome'`, so no Playwright browser download — without Chrome, run
  `npx playwright install chromium` and drop `channel`). For one test:
  `npm --prefix example run build && npx playwright test -g '<title>'`.

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
- A **global pointer state machine**: `OnMouseDown/Move/Up` (names kept so host
  overrides still work) are bound to `pointerdown/move/up` and dispatch by
  `event.button` (0/1/2); `pointercancel` drops any drag. `initialize` sets
  `touch-action: none` and `user-select: none` on the SVG. Zoom is on the standard
  `wheel` event (`normalizeWheel` in `Utils.js`, ~1 step per notch; a zero delta is
  ignored rather than resetting the zoom). Drag routing is by mutually exclusive state fields — `this.offset` (panning
  the whole scene), `this.arrow` (a link being drawn: a host hook — the host sets it
  to any object with `Drag(event)` and `Remove()`; the library never creates one),
  `this.dragItem` (an item is being dragged). A drag with < 3 `jitter` moves is treated as a click and dispatched
  to the item's `LeftClick`/`MiddleClick`/`RightClick`.
- The `#Arrow` SVG marker referenced by links must be defined in the host's `<defs>`
  (again, see `example/example.html`).

### Items

- **`BaseObject`** (`js/BaseObject.js`) — base for draggable items. Holds a `position`
  model, re-renders on its `change`. Parent/child: a child stores an `offset` relative
  to its parent and follows `parent.position` `change` via `ParentDrag`. `OnMouseDown`
  sets `context.a.dragItem = this`; `Drag` converts client coords through
  `context.a.scale` and writes back to `position`. The constructor calls `render()`
  once the whole `initialize` chain has run (so subclasses never call it themselves,
  and their own elements exist first); `initialize` binds `render` to `change` only
  after the initial `ParentDrag` for the same reason. `Link` does the same. Model
  listeners use `listenTo`, so Backbone's `remove()` drops them; `BaseObject.remove()`
  also takes the item out of `parent.children` (it doesn't remove links to it).
- **`Node`** (`js/Node.js`) — `circle` + `text` in a `g.node`. Its `Drag` clamps the
  node inside the parent group's bounds.
- **`Group`** (`js/Group.js`) — `rect` + label in a `g.group`. Its `Drag` can *grow*
  the parent's size when a child is dragged past the edge (`parent.Size(w, h)`).
  Collapsing is driven by a `collapsed` attribute on the group's `Position`
  (`Collapse()` / `Expand()` / `ToggleCollapse()` just set it): the rect shrinks to
  `Group.COLLAPSED_HEIGHT` (`h` keeps the expanded height), and descendants are hidden
  via `BaseObject.children` / `UpdateVisibility()`. The library has no title label;
  the example's `Group` subclass adds one and toggles collapse on its `dblclick`.
  A `rect.handle` in the bottom-right corner (hidden while collapsed) resizes the
  group: `OnHandleDown` installs a plain `{jitter, Drag}` object as
  `context.a.dragItem` (so the group's click hooks don't fire), whose `Drag` calls
  `Resize(w, h)`. `Resize` clamps to `MinSize()` — the largest child `Extent()` (a
  node's center plus its `radius`; a nested group's size plus the 10px margin) and
  `Group.MIN_SIZE` — then grows the parent through its own `Resize` if needed.
- **`Link`** (`js/Link.js`) — extends `Backbone.View` directly (not `BaseObject`). An
  SVG `path` (quadratic bézier) between two nodes; re-renders when *either* endpoint's
  `position` changes. Draggable to bend the curve — the bend amount is an `arc` value
  held in its own `Backbone.Model`, and shift-left-click resets it to 0. An end hidden
  inside a collapsed group attaches to the outermost collapsed group instead (`Ends()`,
  `Link.Center`, `Link.Edge`); a link with both ends in the same collapsed group hides.

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
closes the socket. `Socket` itself is covered by `test/socket.spec.js`; the `Avispa`
wiring (`socket` option → `OnMessage`, `remove()`) is not, since the example doesn't
use a socket.

### Host integration pattern

Host apps subclass the exported classes (`Avispa`, `Group`, `Node`, `Link`) and
override `initialize` (calling `super`), `render`, `OnMessage`, and the `*Click` /
`OnContextMenu` hooks. `example/src/example.js` is the reference for wiring: construct
items with a `new Avispa.Position({...})`, then `append` their `$el` into the right
layer (`graph.$groups`, `graph.$objects`, etc.). The example puts its items on
`window.example` for the console and the tests. `Avispa.js` re-exports `Position`,
`Group`, `Node`, `Link`, `Socket`, `$SVG`, and `cancelEvent`.

## Known state / gotchas

The `js/` sources are a port from a single CoffeeScript file (see history around
`098abd1`). Pan, wheel zoom, node/group drag, link bending, nested-group growth,
collapse, and touch drag are covered by `npm test`. Fixed so far:

- `js/Utils.js` now exports `$SVG` (used by `Node`, `Group`, `Link`, and re-exported
  by `Avispa.js`); the dead local `$SVG`/`normalizeWheel` copies in `Avispa.js` were
  removed in favor of the `Utils.js` versions.
- `Link.render` now builds its `d` attribute with a real template literal, and uses
  `Link.RAD` (was `this.RAD`, which is `undefined` on an instance for a static field).
- Port regressions vs. the CoffeeScript original (`git show 8e00f81:src/avispa.litcoffee`):
  `normalizeWheel` reads `event.originalEvent` (jQuery 3 dropped `event.props.push`, so
  `wheelDelta` was missing and every wheel tick reset zoom); `Zoom` clamps to
  `zoom.min`/`zoom.max`; `Link.Drag` sign/precedence fixed; `BaseObject.size` →
  `Size` (called by `Group.Drag`); `OnMouseUp` guards optional click hooks and always
  calls `MouseUp`, as the original did.
- `BaseObject.initialize` used to bind `render` before the initial `ParentDrag`, so
  any nested subclass rendered before its own elements existed (the example's nested
  `Group` crashed on its missing `$label`).
- A plain library `Group` was never drawn in place until its position first changed;
  rendering from the constructor fixed that for every item.
- Legacy input replaced: `mousewheel`/`DOMMouseScroll` → `wheel`, `event.which` →
  `event.button`, mouse → pointer events (touch and pen drag; multi-touch gestures
  such as pinch-zoom are not handled).
- `this.arrow` is not missing port work — the CoffeeScript original never set it
  either.
- `js/Socket.js` was hardened while being integrated: added the pre-open send queue,
  guarded `JSON.parse` / `'pong'` handling, `close()`, capped-and-persistent reconnect
  backoff (previously it gave up permanently once backoff passed `maxtime`), and
  callback hooks. Behavior change: a socket that can't connect now retries forever at
  the `maxtime` interval instead of stopping.
