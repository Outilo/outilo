/* global outilo, NotesLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Notes', subtitle: 'Prises de notes rapides, enregistrées automatiquement sur votre PC.', search: 'Rechercher…',
    new: 'Nouvelle', export: 'Exporter tout (.md)', pin: 'Épingler', unpin: 'Désépingler', copy: 'Copier', delete: 'Supprimer',
    confirm: 'Confirmer ?', placeholder: 'Première ligne = titre…', untitled: 'Sans titre', saved: 'Enregistré à {time}',
    copied: 'Copié', exported: 'Notes exportées', empty: 'Aucune note', welcome: '# Ma première note\n\nTout est enregistré automatiquement, dans une base privée sur ce PC.\n'
  },
  en: {
    title: 'Notes', subtitle: 'Quick notes, saved automatically on your PC.', search: 'Search…',
    new: 'New', export: 'Export all (.md)', pin: 'Pin', unpin: 'Unpin', copy: 'Copy', delete: 'Delete',
    confirm: 'Confirm?', placeholder: 'First line = title…', untitled: 'Untitled', saved: 'Saved at {time}',
    copied: 'Copied', exported: 'Notes exported', empty: 'No note', welcome: '# My first note\n\nEverything is saved automatically, in a private database on this PC.\n'
  }
}

var $ = function (s) { return document.querySelector(s) }
var notes = []
var current = null
var saveTimer
var confirming = false

async function load() {
  var r = await outilo.sql.query('SELECT id, body, pinned, created, updated FROM note')
  notes = r.rows.map(function (x) { return { id: x[0], body: x[1], pinned: x[2], created: x[3], updated: x[4] } })
}

function renderList() {
  var list = $('#list')
  list.innerHTML = ''
  var shown = NotesLogic.filter(notes, $('#search').value)
  if (!shown.length) { var p = document.createElement('p'); p.className = 'o-empty'; p.textContent = outilo.t('empty'); list.appendChild(p) }
  shown.forEach(function (n) {
    var d = document.createElement('div')
    d.className = 'item' + (current && current.id === n.id ? ' on' : '')
    var s = document.createElement('strong')
    s.textContent = (n.pinned ? '★ ' : '') + (NotesLogic.title(n.body) || outilo.t('untitled'))
    var sm = document.createElement('small')
    sm.textContent = new Date(n.updated).toLocaleDateString(outilo.locale) + ' · ' + NotesLogic.excerpt(n.body)
    d.append(s, sm)
    d.addEventListener('click', function () { select(n) })
    list.appendChild(d)
  })
}

function select(n) {
  flush()
  current = n
  confirming = false
  $('#body').value = n ? n.body : ''
  $('#body').disabled = !n
  $('#pin').textContent = outilo.t(n && n.pinned ? 'unpin' : 'pin')
  $('#delete').textContent = outilo.t('delete')
  $('#saved').textContent = ''
  renderList()
  if (n) $('#body').focus()
}

async function create(body) {
  var now = Date.now()
  await outilo.sql.query('INSERT INTO note (body, created, updated) VALUES (?, ?, ?)', [body || '', now, now])
  await load()
  select(notes.reduce(function (a, b) { return a && a.id > b.id ? a : b }, null))
}

async function save() {
  if (!current) return
  current.body = $('#body').value
  current.updated = Date.now()
  await outilo.sql.query('UPDATE note SET body = ?, updated = ? WHERE id = ?', [current.body, current.updated, current.id])
  $('#saved').textContent = outilo.t('saved', { time: new Date().toLocaleTimeString(outilo.locale) })
  renderList()
}

function flush() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; save() } }

$('#body').addEventListener('input', function () { clearTimeout(saveTimer); saveTimer = setTimeout(function () { saveTimer = null; save() }, 500) })
$('#search').addEventListener('input', renderList)
$('#new').addEventListener('click', function () { create('') })
$('#pin').addEventListener('click', async function () {
  if (!current) return
  current.pinned = current.pinned ? 0 : 1
  await outilo.sql.query('UPDATE note SET pinned = ? WHERE id = ?', [current.pinned, current.id])
  select(current)
})
$('#copy').addEventListener('click', async function () {
  if (!current) return
  await outilo.clipboard.write($('#body').value)
  outilo.toast(outilo.t('copied'), 'success')
})
$('#delete').addEventListener('click', async function () {
  if (!current) return
  if (!confirming) { confirming = true; $('#delete').textContent = outilo.t('confirm'); return }
  await outilo.sql.query('DELETE FROM note WHERE id = ?', [current.id])
  await load()
  select(NotesLogic.filter(notes, '')[0] || null)
})
$('#export').addEventListener('click', async function () {
  flush()
  if (await outilo.files.save('notes.md', NotesLogic.exportMarkdown(NotesLogic.filter(notes, '')))) outilo.toast(outilo.t('exported'), 'success')
})

outilo.onLocale(function () { select(current) })
outilo.onCommand(function (cmd) { if (cmd === 'new') create('') })
outilo.ready.then(async function () {
  try {
    await outilo.sql.exec(NotesLogic.SCHEMA)
    await load()
    if (!notes.length) await create(outilo.t('welcome'))
    else select(NotesLogic.filter(notes, '')[0])
  } catch (e) {
    outilo.toast(e.message, 'error')
  }
})
