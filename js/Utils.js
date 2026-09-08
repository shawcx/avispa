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

exports.normalizeWheel = function(event) {
    if (event.wheelDelta) return event.wheelDelta / 120
    if (event.detail)     return event.detail     /  -3
    return 0
}
