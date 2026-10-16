'use strict'

const $ = require('jquery')

exports.cancelEvent = function(event) {
    event.preventDefault()
    event.stopPropagation()
    return false
}

exports.$SVG = function(name) {
    return $(document.createElementNS('http://www.w3.org/2000/svg', name))
}

// zoom steps for a `wheel` event: about 1 per mouse-wheel notch, positive when
// scrolling up. jQuery doesn't copy the deltas, so read the native event.
exports.normalizeWheel = function(event) {
    event = event.originalEvent || event
    switch (event.deltaMode) {
        case 0:  return -event.deltaY / 100        // pixels: ~100 per notch
        case 1:  return -event.deltaY / 3          // lines: 3 per notch
        default: return -Math.sign(event.deltaY)   // pages
    }
}
