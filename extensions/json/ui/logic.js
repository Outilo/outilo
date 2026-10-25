// Outils JSON (testés par tests/extensions/json.test.mjs). YAML : js-yaml (MIT), dans vendor/.
;(function (root) {
  'use strict'

  /** Position (index) de la première erreur de syntaxe, le moteur ne la donnant pas toujours. */
  function errorIndex(s) {
    var i = 0
    function ws() { while (i < s.length && ' \t\n\r'.indexOf(s[i]) >= 0) i++ }
    function fail() { throw i }
    function lit(word) { if (s.slice(i, i + word.length) !== word) fail(); i += word.length }
    function str() {
      i++
      while (i < s.length && s[i] !== '"') {
        if (s.charCodeAt(i) < 32) fail()
        if (s[i] === '\\') {
          i++
          if (s[i] === 'u') { if (!/^[0-9a-fA-F]{4}$/.test(s.slice(i + 1, i + 5))) fail(); i += 4 }
          else if ('"\\/bfnrt'.indexOf(s[i]) < 0) fail()
        }
        i++
      }
      if (s[i] !== '"') fail()
      i++
    }
    function num() {
      var m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i))
      if (!m) fail()
      i += m[0].length
    }
    function value() {
      ws()
      var c = s[i]
      if (c === '{') {
        i++; ws()
        if (s[i] === '}') { i++; return }
        for (;;) {
          ws(); if (s[i] !== '"') fail(); str(); ws()
          if (s[i] !== ':') fail(); i++; value(); ws()
          if (s[i] === ',') { i++; continue }
          if (s[i] === '}') { i++; return }
          fail()
        }
      } else if (c === '[') {
        i++; ws()
        if (s[i] === ']') { i++; return }
        for (;;) {
          value(); ws()
          if (s[i] === ',') { i++; continue }
          if (s[i] === ']') { i++; return }
          fail()
        }
      } else if (c === '"') str()
      else if (c === 't') lit('true')
      else if (c === 'f') lit('false')
      else if (c === 'n') lit('null')
      else num()
    }
    try {
      value(); ws()
      return i < s.length ? i : null
    } catch (pos) {
      return pos
    }
  }

  /** Analyse avec position de l'erreur (ligne / colonne, à partir de 1). */
  function parse(text) {
    try {
      return { ok: true, value: JSON.parse(text) }
    } catch (e) {
      // Le moteur recopie parfois tout le texte dans le message : on le coupe
      var msg = String(e.message).replace(/^JSON\.parse: /, '').replace(/, "[\s\S]*$/, '').split('\n')[0]
      var at = errorIndex(text)
      if (at == null) return { ok: false, error: msg, line: null, col: null }
      var before = text.slice(0, at).split('\n')
      return { ok: false, error: msg, line: before.length, col: before[before.length - 1].length + 1 }
    }
  }

  function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys)
    if (value && typeof value === 'object') {
      var out = {}
      Object.keys(value).sort().forEach(function (k) { out[k] = sortKeys(value[k]) })
      return out
    }
    return value
  }

  /** indent : nombre d'espaces, ou « tab ». */
  function format(value, indent, sort) {
    var v = sort ? sortKeys(value) : value
    return JSON.stringify(v, null, indent === 'tab' ? '\t' : Number(indent))
  }

  function minify(value) {
    return JSON.stringify(value)
  }

  function toYaml(value) {
    return root.jsyaml.dump(value, { lineWidth: 120, noRefs: true })
  }

  function fromYaml(text) {
    try {
      return { ok: true, value: root.jsyaml.load(text, { schema: root.jsyaml.JSON_SCHEMA }) }
    } catch (e) {
      var mark = e.mark || {}
      return { ok: false, error: e.reason || String(e.message), line: mark.line != null ? mark.line + 1 : null, col: mark.column != null ? mark.column + 1 : null }
    }
  }

  /** Nombre de nœuds, profondeur maximale. */
  function stats(value) {
    var nodes = 0
    var depth = 0
    ;(function walk(v, d) {
      nodes++
      if (d > depth) depth = d
      if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { walk(v[k], d + 1) })
    })(value, 0)
    return { nodes: nodes, depth: depth }
  }

  root.JsonLogic = { parse: parse, format: format, minify: minify, sortKeys: sortKeys, toYaml: toYaml, fromYaml: fromYaml, stats: stats }
})(typeof window !== 'undefined' ? window : globalThis)
