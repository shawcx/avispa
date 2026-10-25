'use strict'

// Smoke tests that drive example/example.html in Chrome with real pointer,
// wheel, and touch input, and read the results back from the SVG.

const { test, expect } = require('@playwright/test')

// links in the order example/src/example.js creates them
const N1_N3 = 0
const N3_N2 = 1
const N2_N4 = 2
const N3_N4 = 3

let errors

test.beforeEach(async ({ page }) => {
    errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/example.html')
    await page.waitForSelector('g.link')
})

test.afterEach(() => {
    expect(errors).toEqual([])
})

// everything on screen, in surface coordinates
function state(page) {
    return page.evaluate(() => {
        const shown = el => el.style.display !== 'none'
        const num   = (el, name) => parseFloat(el.getAttribute(name))

        const groups = {}
        for (const g of document.querySelectorAll('g.group')) {
            const r = g.querySelector('rect')
            groups[g.querySelector('text').textContent] = {
                x: num(r, 'x'), y: num(r, 'y'), w: num(r, 'width'), h: num(r, 'height'), shown: shown(g),
                handle: shown(g.querySelector('rect.handle')),
            }
        }

        const nodes = {}
        for (const g of document.querySelectorAll('g.node')) {
            const c = g.querySelector('circle')
            nodes[g.querySelector('text').textContent] = { x: num(c, 'cx'), y: num(c, 'cy'), shown: shown(g) }
        }

        // d is "M lx ly Q xc yc rx ry"
        const links = [...document.querySelectorAll('g.link')].map(g => {
            const [lx, ly, xc, yc, rx, ry] = g.querySelector('path').getAttribute('d')
                .split(' ').filter(v => !isNaN(parseFloat(v))).map(Number)
            return { start: [lx, ly], control: [xc, yc], end: [rx, ry], shown: shown(g) }
        })

        const pan  = document.querySelector('g.pan').getAttribute('transform')
        const zoom = document.querySelector('g.zoom').getAttribute('transform') || 'scale(1)'

        return {
            groups, nodes, links,
            pan:   pan.match(/-?[\d.]+/g).map(Number),
            scale: parseFloat(zoom.match(/[\d.]+/)[0]),
        }
    })
}

const scale = async page => (await state(page)).scale

// surface coordinates -> page coordinates
function toPage(page, x, y) {
    return page.evaluate(([x, y]) => {
        const zoom = document.querySelector('g.zoom')
        let p = zoom.ownerSVGElement.createSVGPoint()
        p.x = x
        p.y = y
        p = p.matrixTransform(zoom.getScreenCTM())
        return [p.x, p.y]
    }, [x, y])
}

// a page point on part of a group (its title 'text', or its 'rect.handle')
// that nothing else is drawn over
function groupPoint(page, title, part) {
    return page.evaluate(([title, part]) => {
        const group = [...document.querySelectorAll('g.group')].find(g => g.querySelector('text').textContent === title)
        const el    = group.querySelector(part)
        const box   = el.getBoundingClientRect()
        for (const fy of [0.5, 0.3, 0.7]) {
            for (let fx = 0.1; fx < 1; fx += 0.1) {
                const [x, y] = [box.x + box.width * fx, box.y + box.height * fy]
                if (document.elementFromPoint(x, y) === el) return [x, y]
            }
        }
        throw new Error(`the ${part} of ${title} is covered`)
    }, [title, part])
}

// a page point on a link's path that nothing is drawn over
function linkPoint(page, index) {
    return page.evaluate(index => {
        const path   = document.querySelectorAll('g.link path')[index]
        const length = path.getTotalLength()
        for (const f of [0.5, 0.4, 0.6, 0.3, 0.7]) {
            const p = path.getPointAtLength(length * f).matrixTransform(path.getScreenCTM())
            if (document.elementFromPoint(p.x, p.y) === path) return [p.x, p.y]
        }
        throw new Error(`link ${index} is covered`)
    }, index)
}

async function drag(page, [x1, y1], [x2, y2]) {
    await page.mouse.move(x1, y1)
    await page.mouse.down()
    await page.mouse.move(x2, y2, { steps: 8 })
    await page.mouse.up()
}

// pointer coordinates are fractional, so compare positions within rounding
function expectAt(item, x, y) {
    expect(item.x).toBeCloseTo(x, 3)
    expect(item.y).toBeCloseTo(y, 3)
}

// how far a point lies outside a group's rect (0 when inside)
function outside([x, y], g) {
    return Math.hypot(Math.max(g.x - x, 0, x - g.x - g.w), Math.max(g.y - y, 0, y - g.y - g.h))
}

// how far a link's control point is from the middle of its ends: the bend
function bulge(link) {
    return Math.hypot(
        link.control[0] - (link.start[0] + link.end[0]) / 2,
        link.control[1] - (link.start[1] + link.end[1]) / 2)
}


test('every item is drawn in place on load', async ({ page }) => {
    const s = await state(page)

    expect(Object.keys(s.groups)).toEqual(['Group 1', 'Group 2', 'Group 3'])
    expect(Object.keys(s.nodes)).toEqual(['Node 1', 'Node 2', 'Node 3', 'Node 4'])

    // groups render without the host calling render(), and children sit at
    // their offset from the parent, a nested group's included
    expect(s.groups['Group 1']).toEqual({ x: -30, y: -50, w: 150, h: 150, shown: true, handle: true })
    expect(s.groups['Group 3']).toEqual({ x: 240, y: 100, w: 90,  h: 90,  shown: true, handle: true })
    expect(s.nodes['Node 4']).toEqual({ x: 285, y: 155, shown: true })
    expect(s.links.every(l => l.shown)).toBe(true)
})

test('the wheel zooms in steps and stops at the limits', async ({ page }) => {
    await page.mouse.move(100, 100)

    await page.mouse.wheel(0, -100)
    await expect.poll(() => scale(page)).toBeCloseTo(1.125)

    // a horizontal-only scroll doesn't reset the zoom
    await page.mouse.wheel(50, 0)
    await page.mouse.wheel(0, -100)
    await expect.poll(() => scale(page)).toBeCloseTo(1.25)

    await page.mouse.wheel(0, 10000)
    await expect.poll(() => scale(page)).toBeCloseTo(0.125)

    await page.mouse.wheel(0, -10000)
    await expect.poll(() => scale(page)).toBeCloseTo(2.5)
})

test('the wheel zooms toward the pointer', async ({ page }) => {
    const n3 = (await state(page)).nodes['Node 3']
    const at = await toPage(page, n3.x, n3.y)
    await page.mouse.move(...at)

    for (const [dy, zoomed] of [[-300, 1.375], [500, 0.75]]) {
        await page.mouse.wheel(0, dy)
        await expect.poll(() => scale(page)).toBeCloseTo(zoomed)

        // Node 3 stays under the pointer
        const now = await toPage(page, n3.x, n3.y)
        expect(now[0]).toBeCloseTo(at[0], 1)
        expect(now[1]).toBeCloseTo(at[1], 1)
    }
})

test('dragging the background pans; middle-click recenters', async ({ page }) => {
    const s = await state(page)

    await drag(page, [100, 100], [160, 140])
    const panned = (await state(page)).pan
    expect(panned[0] - s.pan[0]).toBeCloseTo(60, 0)
    expect(panned[1] - s.pan[1]).toBeCloseTo(40, 0)

    await page.mouse.wheel(0, -200)
    await expect.poll(() => scale(page)).toBeCloseTo(1.25)

    await page.mouse.click(100, 100, { button: 'middle' })
    const t = await state(page)
    expect(t.scale).toBe(1)
    expect(t.pan).toEqual(s.pan)
})

test('a node drags within its group and stops at the edge', async ({ page }) => {
    const s  = await state(page)
    const n2 = s.nodes['Node 2']

    await drag(page, await toPage(page, n2.x, n2.y), await toPage(page, n2.x + 20, n2.y + 10))
    let t = await state(page)
    expectAt(t.nodes['Node 2'], n2.x + 20, n2.y + 10)
    expect(t.links[N3_N2].end).not.toEqual(s.links[N3_N2].end)

    // far past Group 1's right edge
    const g1 = s.groups['Group 1']
    await drag(page,
        await toPage(page, n2.x + 20, n2.y + 10),
        await toPage(page, n2.x + 300, n2.y + 10))
    t = await state(page)
    expect(t.nodes['Node 2'].x).toBe(g1.x + g1.w)
})

test('dragging a group moves its children with it', async ({ page }) => {
    const s  = await state(page)
    const g1 = s.groups['Group 1']

    // Group 1's bottom-left corner, clear of its nodes
    const from = await toPage(page, g1.x + 10, g1.y + g1.h - 10)
    await drag(page, from, [from[0] - 50, from[1] - 30])

    const t = await state(page)
    expectAt(t.groups['Group 1'], g1.x - 50, g1.y - 30)
    for (const name of ['Node 1', 'Node 2']) {
        expectAt(t.nodes[name], s.nodes[name].x - 50, s.nodes[name].y - 30)
    }
})

test('a link bends when dragged and shift-click straightens it', async ({ page }) => {
    const s  = await state(page)
    const n1 = s.nodes['Node 1']
    const n3 = s.nodes['Node 3']

    // drag square to the link, toward the side that grows the bend
    const length = Math.hypot(n3.x - n1.x, n3.y - n1.y)
    const side   = [(n3.y - n1.y) / length, -(n3.x - n1.x) / length]
    const at     = await linkPoint(page, N1_N3)
    await drag(page, at, [at[0] + side[0] * 60, at[1] + side[1] * 60])
    expect(bulge((await state(page)).links[N1_N3])).toBeGreaterThan(bulge(s.links[N1_N3]) + 20)

    await page.keyboard.down('Shift')
    await page.mouse.click(...await linkPoint(page, N1_N3))
    await page.keyboard.up('Shift')
    expect(bulge((await state(page)).links[N1_N3])).toBeLessThan(2)
})

test('middle- and right-clicking items does nothing harmful', async ({ page }) => {
    const s = await state(page)

    for (const at of [await linkPoint(page, N1_N3), await toPage(page, s.nodes['Node 1'].x, s.nodes['Node 1'].y)]) {
        await page.mouse.click(...at, { button: 'middle' })
        await page.mouse.click(...at, { button: 'right' })
    }

    // still responsive: a background drag pans
    await drag(page, [100, 100], [130, 100])
    expect((await state(page)).pan[0]).toBeCloseTo(s.pan[0] + 30, 0)
})

test('dragging a nested group past its parent\'s edge grows the parent', async ({ page }) => {
    const s  = await state(page)
    const g3 = s.groups['Group 3']

    // Group 3's bottom-left corner, clear of Node 4
    const from = await toPage(page, g3.x + 5, g3.y + g3.h - 5)
    await drag(page, from, [from[0] + 100, from[1] + 80])

    const t  = await state(page)
    const g2 = t.groups['Group 2']
    const moved = t.groups['Group 3']
    expect(g2.w).toBeGreaterThan(s.groups['Group 2'].w)
    expect(g2.h).toBeGreaterThan(s.groups['Group 2'].h)

    // the nested group keeps a 10px margin inside its grown parent
    expect(g2.x + g2.w - (moved.x + moved.w)).toBeCloseTo(10, 0)
    expect(g2.y + g2.h - (moved.y + moved.h)).toBeCloseTo(10, 0)

    // and its node came along
    expect(t.nodes['Node 4'].x - s.nodes['Node 4'].x).toBeCloseTo(moved.x - g3.x, 5)
    expect(t.nodes['Node 4'].y - s.nodes['Node 4'].y).toBeCloseTo(moved.y - g3.y, 5)
})

test('a group\'s corner handle resizes it, but no smaller than its contents', async ({ page }) => {
    const s  = await state(page)
    const g1 = s.groups['Group 1']

    // larger (down more than right, so the corner stays clear of Node 3):
    // the group's own position and its nodes stay put
    let at = await groupPoint(page, 'Group 1', 'rect.handle')
    await drag(page, at, [at[0] + 20, at[1] + 40])
    let t = await state(page)
    expectAt(t.groups['Group 1'], g1.x, g1.y)
    expect(t.groups['Group 1'].w).toBeCloseTo(g1.w + 20, 3)
    expect(t.groups['Group 1'].h).toBeCloseTo(g1.h + 40, 3)
    expect(t.nodes).toEqual(s.nodes)

    // far smaller: stops where Node 2 (offset 105,85, radius 30) still fits
    at = await groupPoint(page, 'Group 1', 'rect.handle')
    await drag(page, at, [at[0] - 150, at[1] - 150])
    t = await state(page)
    expect(t.groups['Group 1']).toMatchObject({ w: 135, h: 115 })
})

test('resizing a nested group grows its parent, which then can\'t shrink below it', async ({ page }) => {
    // Group 3 sits at offset (90, 40) in Group 2 and keeps a 10px margin
    let at = await groupPoint(page, 'Group 3', 'rect.handle')
    await drag(page, at, [at[0] + 100, at[1] + 80])
    let t = await state(page)
    expect(t.groups['Group 3'].w).toBeCloseTo(190, 3)
    expect(t.groups['Group 3'].h).toBeCloseTo(170, 3)
    expect(t.groups['Group 2'].w).toBeCloseTo(90 + 190 + 10, 3)
    expect(t.groups['Group 2'].h).toBeCloseTo(40 + 170 + 10, 3)

    at = await groupPoint(page, 'Group 2', 'rect.handle')
    await drag(page, at, [at[0] - 200, at[1] - 200])
    t = await state(page)
    expect(t.groups['Group 2'].w).toBeCloseTo(90 + 190 + 10, 3)
    expect(t.groups['Group 2'].h).toBeCloseTo(40 + 170 + 10, 3)
})

test('double-clicking a title collapses and expands groups, nested ones included', async ({ page }) => {
    const toggle = async title => page.mouse.dblclick(...await groupPoint(page, title, 'text'))
    const s = await state(page)

    // the nested group: its node hides and links to it attach to its bar
    await toggle('Group 3')
    let t = await state(page)
    expect(t.groups['Group 3']).toMatchObject({ h: 30, shown: true, handle: false })
    expect(t.nodes['Node 4'].shown).toBe(false)
    for (const i of [N2_N4, N3_N4]) {
        expect(t.links[i].end).not.toEqual(s.links[i].end)
        expect(outside(t.links[i].end, t.groups['Group 3'])).toBeLessThanOrEqual(4)
    }

    // double-clicking doesn't select the title's text
    expect(await page.evaluate(() => getSelection().toString())).toBe('')

    // the outer group: everything inside hides, and links attach to its bar
    await toggle('Group 2')
    t = await state(page)
    expect(t.groups['Group 2']).toMatchObject({ h: 30, shown: true })
    expect(t.groups['Group 3'].shown).toBe(false)
    expect(t.nodes['Node 3'].shown).toBe(false)
    expect(t.links[N3_N4].shown).toBe(false)   // both ends inside Group 2
    expect(outside(t.links[N1_N3].end,   t.groups['Group 2'])).toBeLessThanOrEqual(4)
    expect(outside(t.links[N3_N2].start, t.groups['Group 2'])).toBeLessThanOrEqual(4)
    expect(outside(t.links[N2_N4].end,   t.groups['Group 2'])).toBeLessThanOrEqual(4)

    // expanding the outer group leaves the nested one collapsed
    await toggle('Group 2')
    t = await state(page)
    expect(t.groups['Group 2'].h).toBe(s.groups['Group 2'].h)
    expect(t.groups['Group 3']).toMatchObject({ h: 30, shown: true })
    expect(t.nodes['Node 3'].shown).toBe(true)
    expect(t.nodes['Node 4'].shown).toBe(false)

    // and expanding that puts everything back
    await toggle('Group 3')
    expect(await state(page)).toEqual(s)
})

test('a removed item stops following its models and leaves its group', async ({ page }) => {
    // Node 2 and the links to it
    const removed = () => page.evaluate(() => ({
        n2:    window.example.n2.position.pick('x', 'y'),
        link3: window.example.link3.path.attr('d'),
    }))
    await page.evaluate(() => {
        const { n2, link2, link3 } = window.example
        for (const item of [link2, link3, n2]) item.remove()
    })
    const before = await removed()
    const s = await state(page)
    expect(Object.keys(s.nodes)).toEqual(['Node 1', 'Node 3', 'Node 4'])
    expect(s.links).toHaveLength(2)

    // moving Node 2's group and Node 4, the other end of a removed link,
    // no longer reaches them
    const g1   = s.groups['Group 1']
    const from = await toPage(page, g1.x + 10, g1.y + g1.h - 10)
    await drag(page, from, [from[0] - 50, from[1] - 30])
    const n4 = s.nodes['Node 4']
    await drag(page, await toPage(page, n4.x, n4.y), await toPage(page, n4.x - 10, n4.y + 10))
    let t = await state(page)
    expectAt(t.groups['Group 1'], g1.x - 50, g1.y - 30)
    expectAt(t.nodes['Node 4'], n4.x - 10, n4.y + 10)
    expect(await removed()).toEqual(before)

    // and Group 1 now shrinks to fit just Node 1 (offset 35,55, radius 30)
    const at = await groupPoint(page, 'Group 1', 'rect.handle')
    await drag(page, at, [at[0] - 150, at[1] - 150])
    t = await state(page)
    expect(t.groups['Group 1']).toMatchObject({ w: 65, h: 85 })
})

// the surface as a box inside the page instead of the whole window
const BOX = { left: 200, top: 140, width: 720, height: 460 }

test.describe('embedded in a page', () => {
    test.beforeEach(async ({ page }) => {
        // an adopted sheet wins over the page's own <style>, and is in place
        // before the example builds its graph
        await page.addInitScript(box => {
            const sheet = new CSSStyleSheet()
            sheet.replaceSync(`div#surface {
                left: ${box.left}px; top: ${box.top}px; width: ${box.width}px; height: ${box.height}px;
                right: auto; bottom: auto;
            }`)
            document.adoptedStyleSheets = [sheet]
        }, BOX)
        await page.goto('/example.html')
        await page.waitForSelector('g.link')
    })

    // a point on the background near the box's bottom-left corner
    const corner = [BOX.left + 20, BOX.top + BOX.height - 20]

    test('the scene starts centered in the surface, and middle-click recenters it there', async ({ page }) => {
        const middle = [BOX.width / 2, BOX.height / 2]
        expect((await state(page)).pan).toEqual(middle)

        await drag(page, corner, [corner[0] + 60, corner[1] - 30])
        expect((await state(page)).pan).not.toEqual(middle)
        await page.mouse.click(...corner, { button: 'middle' })
        expect((await state(page)).pan).toEqual(middle)
    })

    test('a drag carries on outside the surface and ends where it is released', async ({ page }) => {
        const s = await state(page)

        // pan past the box's left edge, release out there, then come back
        // over the box with no button down
        await drag(page, corner, [BOX.left - 100, corner[1]])
        let t = await state(page)
        expect(t.pan[0] - s.pan[0]).toBeCloseTo(-120, 0)
        expect(t.pan[1]).toBeCloseTo(s.pan[1], 0)
        await page.mouse.move(...corner, { steps: 4 })
        expect((await state(page)).pan).toEqual(t.pan)

        // and the same with a group, by its bottom-left corner
        const g1   = t.groups['Group 1']
        const from = await toPage(page, g1.x + 10, g1.y + g1.h - 10)
        const to   = [BOX.left - 50, from[1] + 30]
        await drag(page, from, to)
        t = await state(page)
        expectAt(t.groups['Group 1'], g1.x + to[0] - from[0], g1.y + 30)
        await page.mouse.move(...corner, { steps: 4 })
        expect((await state(page)).groups['Group 1']).toEqual(t.groups['Group 1'])
    })
})

test.describe('touch', () => {
    test.use({ hasTouch: true })

    test('pinching zooms around the fingers instead of dragging what they touch', async ({ page }) => {
        const s  = await state(page)
        const n3 = s.nodes['Node 3']
        const [x, y] = await toPage(page, n3.x, n3.y)

        // both fingers land on Node 3, 20px either side of its center, and
        // spread to 40px: twice as far apart
        const cdp   = await page.context().newCDPSession(page)
        const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints })
        const at    = d => [{ x: x - d, y, id: 0 }, { x: x + d, y, id: 1 }]
        await touch('touchStart', at(20))
        for (let d = 22.5; d <= 40; d += 2.5) {
            await touch('touchMove', at(d))
        }

        // touch moves are delivered on animation frames, so the last can lag
        await expect.poll(() => scale(page)).toBeCloseTo(2, 3)
        const t = await state(page)
        expect(t.nodes).toEqual(s.nodes)
        expect(t.groups).toEqual(s.groups)
        const now = await toPage(page, n3.x, n3.y)
        expect(now[0]).toBeCloseTo(x, 1)
        expect(now[1]).toBeCloseTo(y, 1)

        // lifting one finger and moving the other neither pans nor drags, and
        // lifting the last isn't a click
        await page.evaluate(() => {
            window.clicks = 0
            window.example.graph.LeftClick = () => window.clicks++
        })
        await touch('touchEnd', [at(40)[1]])
        await touch('touchMove', [{ x: x + 80, y: y + 40, id: 1 }])
        await touch('touchEnd', [])
        const u = await state(page)
        expect(u.pan).toEqual(t.pan)
        expect(u.nodes).toEqual(s.nodes)
        expect(await page.evaluate(() => window.clicks)).toBe(0)
    })

    test('a touch drag moves a node', async ({ page }) => {
        const s  = await state(page)
        const n2 = s.nodes['Node 2']
        const [x, y] = await toPage(page, n2.x, n2.y)

        const cdp   = await page.context().newCDPSession(page)
        const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints })
        await touch('touchStart', [{ x, y }])
        for (let i = 1; i <= 8; i++) {
            await touch('touchMove', [{ x: x + 2.5 * i, y: y + 1.25 * i }])
        }
        await touch('touchEnd', [])

        expectAt((await state(page)).nodes['Node 2'], n2.x + 20, n2.y + 10)
    })
})
