// Sélection et totaux du nettoyeur (testés par tests/extensions/cleaner.test.mjs).
;(function (root) {
  'use strict'

  var GROUPS = ['system', 'browser', 'dev']
  /** Cochées par défaut : sans risque de perte (la corbeille et les caches de développement restent au choix). */
  var DEFAULTS = ['temp', 'crash-dumps', 'chrome', 'edge', 'brave', 'firefox']

  function defaults(list) {
    return list.filter(function (t) { return t.found && t.bytes > 0 && DEFAULTS.indexOf(t.id) >= 0 }).map(function (t) { return t.id })
  }

  function total(list, selected) {
    return list.reduce(function (acc, t) {
      if (selected.indexOf(t.id) < 0) return acc
      return { bytes: acc.bytes + t.bytes, files: acc.files + t.files }
    }, { bytes: 0, files: 0 })
  }

  function grouped(list) {
    return GROUPS.map(function (g) {
      return { id: g, items: list.filter(function (t) { return t.group === g && t.found }) }
    }).filter(function (g) { return g.items.length })
  }

  function bytes(n, locale) {
    var u = locale === 'en' ? ['B', 'KB', 'MB', 'GB'] : ['o', 'Ko', 'Mo', 'Go']
    var i = 0
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
    return (i ? n.toFixed(n < 10 ? 1 : 0) : n) + ' ' + u[i]
  }

  root.CleanLogic = { defaults: defaults, total: total, grouped: grouped, bytes: bytes }
})(typeof window !== 'undefined' ? window : globalThis)
