// Testeur d'expressions régulières (testé par tests/extensions/regex.test.mjs).
;(function (root) {
  'use strict'

  var MAX_MATCHES = 1000

  var LIBRARY = [
    { id: 'email', pattern: '[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+', flags: 'g', sample: 'contact@exemple.com, jean.dupont+test@mail.exemple.org' },
    { id: 'url', pattern: 'https?:\\/\\/[^\\s/$.?#].[^\\s]*', flags: 'gi', sample: 'Voir https://exemple.com/page?id=3 ou http://localhost:3000' },
    { id: 'ipv4', pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b', flags: 'g', sample: '192.168.1.10 10.0.0.256 8.8.8.8' },
    { id: 'isoDate', pattern: '(?<annee>\\d{4})-(?<mois>0[1-9]|1[0-2])-(?<jour>0[1-9]|[12]\\d|3[01])', flags: 'g', sample: 'Du 2026-10-25 au 2026-13-01' },
    { id: 'phoneFr', pattern: '(?:\\+33\\s?|0)[1-9](?:[\\s.-]?\\d{2}){4}', flags: 'g', sample: '06 39 98 12 34 ou +33 1 23 45 67 89' },
    { id: 'postalFr', pattern: '\\b(?:0[1-9]|[1-8]\\d|9[0-8])\\d{3}\\b', flags: 'g', sample: '75001 Paris, 13008 Marseille, 99999' },
    { id: 'hexColor', pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b', flags: 'g', sample: 'color: #f59e0b; background: #FFF;' },
    { id: 'uuid', pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}', flags: 'gi', sample: 'id=3f1c2a9e-7b4d-4c1a-9e2f-0a1b2c3d4e5f' },
    { id: 'semver', pattern: '\\bv?(\\d+)\\.(\\d+)\\.(\\d+)(?:-([\\w.]+))?\\b', flags: 'g', sample: 'v1.2.3, 0.4.0-beta.1, 10.20.30' },
    { id: 'strongPassword', pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{12,}$', flags: 'gm', sample: 'motdepasse\nMot-De-Passe-2026!' }
  ]

  function compile(pattern, flags) {
    try {
      return { ok: true, re: new RegExp(pattern, flags) }
    } catch (e) {
      return { ok: false, error: String(e.message).replace(/^Invalid regular expression: /, '') }
    }
  }

  /** Liste des correspondances (au plus MAX_MATCHES), avec groupes numérotés et nommés. */
  function matches(re, text) {
    var out = []
    var global = re.global || re.sticky
    var r = new RegExp(re.source, global ? re.flags : re.flags + 'g')
    var m
    while ((m = r.exec(text)) && out.length < MAX_MATCHES) {
      out.push({ index: m.index, end: m.index + m[0].length, match: m[0], groups: m.slice(1), named: m.groups || null })
      if (m[0] === '') r.lastIndex++
      if (!global) break
    }
    return out
  }

  /** Découpe le texte en segments { text, hit } pour le surlignage. */
  function segments(text, list) {
    var out = []
    var pos = 0
    list.forEach(function (m, i) {
      if (m.index > pos) out.push({ text: text.slice(pos, m.index), hit: -1 })
      if (m.end > m.index) out.push({ text: text.slice(m.index, m.end), hit: i })
      pos = Math.max(pos, m.end)
    })
    if (pos < text.length) out.push({ text: text.slice(pos), hit: -1 })
    return out
  }

  function replace(re, text, replacement) {
    return text.replace(re, replacement)
  }

  root.RegexLogic = { compile: compile, matches: matches, segments: segments, replace: replace, LIBRARY: LIBRARY, MAX_MATCHES: MAX_MATCHES }
})(typeof window !== 'undefined' ? window : globalThis)
