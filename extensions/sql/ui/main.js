/* global outilo, SqlLogic */
'use strict'

outilo.messages = {
  fr: {
    subtitle: 'Atelier SQLite : une base privée sur votre PC pour tester des requêtes.', tables: 'Tables',
    run: 'Exécuter (Ctrl+Entrée)', sample: 'Créer une base d’exemple', csv: 'Enregistrer en CSV', copy: 'Copier en CSV',
    script: 'Exécuter le script d’un bloc', copied: 'Copié', saved: 'Fichier enregistré', none: 'Aucune table',
    hint: 'Chaque instruction s’exécute séparément ; pour une transaction, regroupez-la dans un seul bloc avec « Exécuter le script ».',
    result: '{n} ligne(s) · {ms} ms', truncated: ' (limitées à 10 000)', changes: '{n} instruction(s) exécutée(s), {c} ligne(s) modifiée(s) · {ms} ms',
    scriptDone: 'Script exécuté · {ms} ms', error: 'Instruction {i} : {msg}'
  },
  en: {
    subtitle: 'SQLite workbench: a private database on your PC to try queries.', tables: 'Tables',
    run: 'Run (Ctrl+Enter)', sample: 'Create a sample database', csv: 'Save as CSV', copy: 'Copy as CSV',
    script: 'Run as one script', copied: 'Copied', saved: 'File saved', none: 'No table',
    hint: 'Each statement runs separately; for a transaction, run it as one block with “Run as one script”.',
    result: '{n} row(s) · {ms} ms', truncated: ' (capped at 10,000)', changes: '{n} statement(s) run, {c} row(s) changed · {ms} ms',
    scriptDone: 'Script run · {ms} ms', error: 'Statement {i}: {msg}'
  }
}

var $ = function (s) { return document.querySelector(s) }
var last = null

function status(text, error) {
  $('#status').textContent = text
  $('#status').className = 'o-sub' + (error ? ' o-err' : '')
}

function show(r) {
  last = r
  var head = $('#head')
  var rows = $('#rows')
  head.innerHTML = ''
  rows.innerHTML = ''
  if (!r || !r.columns.length) return
  var tr = document.createElement('tr')
  r.columns.forEach(function (c) { var th = document.createElement('th'); th.textContent = c; tr.appendChild(th) })
  head.appendChild(tr)
  r.rows.slice(0, 1000).forEach(function (row) {
    var line = document.createElement('tr')
    row.forEach(function (v) {
      var td = document.createElement('td')
      td.textContent = SqlLogic.cell(v)
      td.title = td.textContent
      if (v == null) { td.textContent = 'NULL'; td.style.color = 'var(--o-muted)' }
      line.appendChild(td)
    })
    rows.appendChild(line)
  })
}

async function tables() {
  var box = $('#tables')
  try {
    var r = await outilo.sql.query("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name")
    box.innerHTML = ''
    if (!r.rows.length) { box.textContent = outilo.t('none'); return }
    r.rows.forEach(function (row) {
      var b = document.createElement('button')
      b.innerHTML = ''
      b.textContent = row[0] + ' '
      var small = document.createElement('small'); small.textContent = row[1]
      b.appendChild(small)
      b.addEventListener('click', function () { $('#sql').value = 'SELECT * FROM "' + row[0].replace(/"/g, '""') + '" LIMIT 100;'; run() })
      box.appendChild(b)
    })
  } catch (e) {
    box.textContent = e.message
  }
}

async function run() {
  var statements = SqlLogic.split($('#sql').value)
  if (!statements.length) return
  var t0 = performance.now()
  var changes = 0
  var shown = null
  for (var i = 0; i < statements.length; i++) {
    try {
      var r = await outilo.sql.query(statements[i])
      if (r.columns.length) shown = r
      changes += r.changes
    } catch (e) {
      status(outilo.t('error', { i: i + 1, msg: e.message }), true)
      tables()
      return
    }
  }
  var ms = Math.round(performance.now() - t0)
  if (shown) {
    show(shown)
    status(outilo.t('result', { n: shown.rows.length, ms: ms }) + (shown.truncated ? outilo.t('truncated') : ''))
  } else {
    show(null)
    status(outilo.t('changes', { n: statements.length, c: changes, ms: ms }))
  }
  tables()
  outilo.storage.set('sql', $('#sql').value.slice(0, 100000)).catch(function () {})
}

$('#run').addEventListener('click', run)
$('#sql').addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run() } })
$('#script').addEventListener('click', async function () {
  var t0 = performance.now()
  try {
    await outilo.sql.exec($('#sql').value)
    status(outilo.t('scriptDone', { ms: Math.round(performance.now() - t0) }))
  } catch (e) { status(e.message, true) }
  tables()
})
$('#sample').addEventListener('click', function () { $('#sql').value = SqlLogic.SAMPLE; run() })
$('#copy').addEventListener('click', async function () {
  if (!last) return
  await outilo.clipboard.write(SqlLogic.toCsv(last))
  outilo.toast(outilo.t('copied'), 'success')
})
$('#csv').addEventListener('click', async function () {
  if (!last) return
  if (await outilo.files.save('resultat.csv', SqlLogic.toCsv(last))) outilo.toast(outilo.t('saved'), 'success')
})

outilo.onLocale(tables)
outilo.ready.then(async function () {
  try { var saved = await outilo.storage.get('sql'); if (saved) $('#sql').value = saved } catch (e) { /* aucun stockage */ }
  tables()
  $('#sql').focus()
})
