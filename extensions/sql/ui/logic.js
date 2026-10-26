// Atelier SQLite (testé par tests/extensions/sql.test.mjs).
;(function (root) {
  'use strict'

  /** Découpe un script en instructions, en respectant chaînes, identifiants entre guillemets et commentaires. */
  function split(sql) {
    var out = []
    var cur = ''
    var i = 0
    var s = String(sql)
    var depth = 0 // BEGIN … END des déclencheurs
    while (i < s.length) {
      var c = s[i]
      var two = s.substr(i, 2)
      if (two === '--') { var nl = s.indexOf('\n', i); i = nl < 0 ? s.length : nl; continue }
      if (two === '/*') { var end = s.indexOf('*/', i + 2); i = end < 0 ? s.length : end + 2; continue }
      if (c === "'" || c === '"' || c === '`' || c === '[') {
        var close = c === '[' ? ']' : c
        var j = i + 1
        while (j < s.length) {
          if (s[j] === close) { if (s[j + 1] === close && close !== ']') { j += 2; continue } break }
          j++
        }
        cur += s.slice(i, j + 1)
        i = j + 1
        continue
      }
      if (/[A-Za-z]/.test(c) && !/[\w]/.test(s[i - 1] || '')) {
        var word = /^[A-Za-z_]+/.exec(s.slice(i))[0]
        var up = word.toUpperCase()
        if (up === 'BEGIN' && /CREATE\s+(TEMP\w*\s+)?TRIGGER/i.test(cur)) depth++
        if (up === 'END' && depth) depth--
        cur += word
        i += word.length
        continue
      }
      if (c === ';' && !depth) { if (cur.trim()) out.push(cur.trim()); cur = ''; i++; continue }
      cur += c
      i++
    }
    if (cur.trim()) out.push(cur.trim())
    return out
  }

  function cell(v) {
    if (v == null) return ''
    if (typeof v === 'object' && v.$blob != null) return '[BLOB ' + Math.round(v.$blob.length * 0.75) + ' o]'
    return String(v)
  }

  function toCsv(result) {
    var esc = function (v) { var s = cell(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
    return [result.columns.map(esc).join(',')].concat(result.rows.map(function (r) { return r.map(esc).join(',') })).join('\n')
  }

  var SAMPLE = [
    'CREATE TABLE IF NOT EXISTS client (id INTEGER PRIMARY KEY, nom TEXT NOT NULL, ville TEXT, depuis TEXT);',
    'CREATE TABLE IF NOT EXISTS commande (id INTEGER PRIMARY KEY, client_id INTEGER REFERENCES client(id), montant REAL, date TEXT);',
    "INSERT INTO client (nom, ville, depuis) VALUES ('Atelier Martin', 'Lyon', '2024-03-01'), ('Studio Nova', 'Nantes', '2025-01-15'), ('Café Lumière', 'Lille', '2025-06-10');",
    "INSERT INTO commande (client_id, montant, date) VALUES (1, 1200, '2025-09-01'), (1, 450.5, '2025-10-12'), (2, 980, '2025-10-20'), (3, 120, '2025-10-22');",
    'SELECT c.nom, c.ville, COUNT(o.id) AS commandes, ROUND(SUM(o.montant), 2) AS total\nFROM client c LEFT JOIN commande o ON o.client_id = c.id\nGROUP BY c.id ORDER BY total DESC;'
  ].join('\n')

  root.SqlLogic = { split: split, cell: cell, toCsv: toCsv, SAMPLE: SAMPLE }
})(typeof window !== 'undefined' ? window : globalThis)
