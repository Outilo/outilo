// Exécuteur JavaScript (testé par tests/extensions/jsrun.test.mjs) : mise en forme des valeurs affichées.
;(function (root) {
  'use strict'

  /** Représentation lisible d'une valeur, façon console (profondeur limitée, références circulaires gérées). */
  function inspect(value, depth, seen) {
    depth = depth == null ? 3 : depth
    seen = seen || []
    var t = typeof value
    if (value === null) return 'null'
    if (t === 'undefined') return 'undefined'
    if (t === 'string') return depth === 3 ? value : JSON.stringify(value)
    if (t === 'number' || t === 'boolean') return Object.is(value, -0) ? '-0' : String(value)
    if (t === 'bigint') return value + 'n'
    if (t === 'symbol') return value.toString()
    if (t === 'function') return '[Function ' + (value.name || 'anonyme') + ']'
    if (value instanceof Error) return value.name + ': ' + value.message
    if (value instanceof Date) return isNaN(value) ? 'Invalid Date' : value.toISOString()
    if (value instanceof RegExp) return String(value)
    if (seen.indexOf(value) >= 0) return '[Circulaire]'
    if (depth < 0) return Array.isArray(value) ? '[Array]' : '[Object]'
    var next = seen.concat([value])
    var sub = function (v) { return inspect(v, depth - 1, next) }
    if (Array.isArray(value)) {
      var items = value.slice(0, 100).map(sub)
      if (value.length > 100) items.push('… ' + (value.length - 100) + ' de plus')
      return '[' + items.join(', ') + ']'
    }
    if (value instanceof Map) return 'Map(' + value.size + ') {' + Array.from(value).slice(0, 50).map(function (e) { return sub(e[0]) + ' => ' + sub(e[1]) }).join(', ') + '}'
    if (value instanceof Set) return 'Set(' + value.size + ') {' + Array.from(value).slice(0, 50).map(sub).join(', ') + '}'
    var keys = Object.keys(value)
    var name = value.constructor && value.constructor.name && value.constructor.name !== 'Object' ? value.constructor.name + ' ' : ''
    var body = keys.slice(0, 50).map(function (k) { return (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ': ' + sub(value[k]) })
    if (keys.length > 50) body.push('…')
    return name + '{' + (body.length ? ' ' + body.join(', ') + ' ' : '') + '}'
  }

  function format(args) {
    return Array.prototype.map.call(args, function (a) { return inspect(a) }).join(' ')
  }

  /** Enveloppe le code : console capturée, await autorisé au premier niveau, fin signalée. */
  function wrap(code, runId) {
    return '(async () => {\n' + code + '\n})().then(' +
      'function (v) { window.__jsrunDone(' + runId + ', v, null) }, function (e) { window.__jsrunDone(' + runId + ', undefined, e) })'
  }

  root.JsRunLogic = { inspect: inspect, format: format, wrap: wrap }
})(typeof window !== 'undefined' ? window : globalThis)
