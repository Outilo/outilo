// Transformations de texte (testées par tests/extensions/text.test.mjs).
;(function (root) {
  'use strict'

  function stripAccents(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '') }

  /** Découpe en mots, y compris camelCase, snake_case et kebab-case. */
  function words(s) {
    return stripAccents(s)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
  }

  var cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() }

  var CASES = {
    upper: function (s) { return s.toUpperCase() },
    lower: function (s) { return s.toLowerCase() },
    title: function (s) { return s.toLowerCase().replace(/(^|[\s\-'’(])(\p{L})/gu, function (m, a, b) { return a + b.toUpperCase() }) },
    sentence: function (s) { return s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, function (m, a, b) { return a + b.toUpperCase() }) },
    camel: function (s) { return words(s).map(function (w, i) { return i ? cap(w) : w.toLowerCase() }).join('') },
    pascal: function (s) { return words(s).map(cap).join('') },
    snake: function (s) { return words(s).map(function (w) { return w.toLowerCase() }).join('_') },
    kebab: function (s) { return words(s).map(function (w) { return w.toLowerCase() }).join('-') },
    constant: function (s) { return words(s).map(function (w) { return w.toUpperCase() }).join('_') },
    slug: function (s) { return words(s).map(function (w) { return w.toLowerCase() }).join('-').slice(0, 80) },
    noAccents: stripAccents,
    invert: function (s) { return s.replace(/\p{L}/gu, function (c) { return c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase() }) }
  }

  var LINES = {
    trim: function (l) { return l.map(function (x) { return x.trim() }) },
    sort: function (l) { return l.slice().sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) }) },
    sortDesc: function (l) { return LINES.sort(l).reverse() },
    unique: function (l) { var seen = {}; return l.filter(function (x) { return seen[x] ? false : (seen[x] = true) }) },
    reverse: function (l) { return l.slice().reverse() },
    removeEmpty: function (l) { return l.filter(function (x) { return x.trim() }) },
    shuffle: function (l) {
      var a = l.slice()
      for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t }
      return a
    },
    number: function (l) { return l.map(function (x, i) { return (i + 1) + '. ' + x }) }
  }

  function transform(text, op) {
    if (CASES[op]) return CASES[op](text)
    if (LINES[op]) return LINES[op](text.split(/\r?\n/)).join('\n')
    return text
  }

  /** Statistiques ; lecture estimée à 230 mots par minute. */
  function stats(text) {
    // Mots : groupes contenant au moins une lettre ou un chiffre (la ponctuation isolée ne compte pas)
    var w = text.split(/\s+/).filter(function (x) { return /[\p{L}\p{N}]/u.test(x) }).length
    return {
      chars: [...text].length,
      charsNoSpaces: [...text.replace(/\s/g, '')].length,
      words: w,
      lines: text ? text.split(/\r?\n/).length : 0,
      sentences: (text.match(/[^.!?…]+[.!?…]+/g) || []).length,
      paragraphs: text.split(/\n\s*\n/).filter(function (p) { return p.trim() }).length,
      readingMinutes: Math.max(w ? 1 : 0, Math.round(w / 230)),
      bytes: new TextEncoder().encode(text).length
    }
  }

  function replaceAll(text, find, by, opts) {
    if (!find) return text
    var flags = 'g' + (opts.caseSensitive ? '' : 'i')
    var re = opts.regex ? new RegExp(find, flags) : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
    return text.replace(re, by)
  }

  root.TextLogic = { transform: transform, stats: stats, replaceAll: replaceAll, words: words, CASES: Object.keys(CASES), LINES: Object.keys(LINES) }
})(typeof window !== 'undefined' ? window : globalThis)
