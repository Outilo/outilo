// Notes (testé par tests/extensions/notes.test.mjs). Stockage : base SQLite privée de l'extension.
;(function (root) {
  'use strict'

  var SCHEMA =
    'CREATE TABLE IF NOT EXISTS note (id INTEGER PRIMARY KEY, body TEXT NOT NULL DEFAULT \'\', pinned INTEGER NOT NULL DEFAULT 0, ' +
    'created INTEGER NOT NULL, updated INTEGER NOT NULL);'

  /** Titre = première ligne non vide, sans marques Markdown. */
  function title(body) {
    var line = String(body).split('\n').find(function (l) { return l.trim() }) || ''
    return line.replace(/^\s*(#{1,6}\s+|[-*>]\s+)?(\[[ x]\]\s+)?/, '').trim().slice(0, 120)
  }

  function excerpt(body) {
    var lines = String(body).split('\n').filter(function (l) { return l.trim() })
    return lines.slice(1).join(' ').replace(/[#*_`>[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140)
  }

  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') }

  /** Recherche insensible à la casse et aux accents ; épinglées d'abord, puis les plus récentes. */
  function filter(notes, query) {
    var words = norm(query).split(/\s+/).filter(Boolean)
    return notes
      .filter(function (n) { var b = norm(n.body); return words.every(function (w) { return b.indexOf(w) >= 0 }) })
      .sort(function (a, b) { return b.pinned - a.pinned || b.updated - a.updated })
  }

  function exportMarkdown(notes) {
    return notes.map(function (n) { return n.body.trim() }).join('\n\n---\n\n') + '\n'
  }

  root.NotesLogic = { SCHEMA: SCHEMA, title: title, excerpt: excerpt, filter: filter, exportMarkdown: exportMarkdown }
})(typeof window !== 'undefined' ? window : globalThis)
