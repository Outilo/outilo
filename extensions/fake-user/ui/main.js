/* global outilo, FakeUserLogic */
'use strict'

var LABELS = {
  fr: { id: 'ID', firstName: 'Prénom', lastName: 'Nom', email: 'E-mail', username: 'Identifiant', phone: 'Téléphone',
    birthdate: 'Naissance', street: 'Adresse', zip: 'Code postal', city: 'Ville', country: 'Pays', company: 'Société',
    jobTitle: 'Poste' },
  en: { id: 'ID', firstName: 'First name', lastName: 'Last name', email: 'Email', username: 'Username', phone: 'Phone',
    birthdate: 'Birthdate', street: 'Street', zip: 'ZIP', city: 'City', country: 'Country', company: 'Company',
    jobTitle: 'Job title' }
}

outilo.messages = {
  fr: {
    title: 'Utilisateurs fictifs', subtitle: 'Données de test réalistes. E-mails et numéros réservés à la fiction.',
    count: 'Nombre', locale: 'Région', seed: 'Graine', seedHint: 'aléatoire', generate: 'Générer', fields: 'Champs',
    copyJson: 'Copier JSON', saveJson: 'Enregistrer JSON', saveCsv: 'Enregistrer CSV', saveSql: 'Enregistrer SQL',
    table: 'Table', copied: 'Copié', saved: 'Fichier enregistré', more: '{n} lignes de plus non affichées (incluses dans les exports)'
  },
  en: {
    title: 'Fake users', subtitle: 'Realistic test data. Emails and phone numbers reserved for fiction.',
    count: 'Count', locale: 'Region', seed: 'Seed', seedHint: 'random', generate: 'Generate', fields: 'Fields',
    copyJson: 'Copy JSON', saveJson: 'Save JSON', saveCsv: 'Save CSV', saveSql: 'Save SQL',
    table: 'Table', copied: 'Copied', saved: 'File saved', more: '{n} more rows not shown (included in exports)'
  }
}

var MAX_ROWS = 200
var $ = function (s) { return document.querySelector(s) }
var state = { count: 10, lang: 'fr', seed: '', fields: FakeUserLogic.FIELDS.filter(function (f) { return f !== 'id' }) }
var users = []

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] })
}

function label(f) { return (LABELS[outilo.locale] || LABELS.fr)[f] }

function renderFields() {
  $('#fields').innerHTML = FakeUserLogic.FIELDS.map(function (f) {
    return '<button class="o-chip' + (state.fields.indexOf(f) >= 0 ? ' on' : '') + '" data-f="' + f + '">' + esc(label(f)) + '</button>'
  }).join('')
}

function renderTable() {
  var fields = state.fields
  $('#head').innerHTML = '<tr>' + fields.map(function (f) { return '<th>' + esc(label(f)) + '</th>' }).join('') + '</tr>'
  $('#rows').innerHTML = users.slice(0, MAX_ROWS).map(function (u) {
    return '<tr>' + fields.map(function (f) {
      var ui = f === 'jobTitle' || f === 'company' || f === 'street'
      return '<td' + (ui ? ' class="ui"' : '') + '>' + esc(u[f]) + '</td>'
    }).join('') + '</tr>'
  }).join('')
  $('#more').textContent = users.length > MAX_ROWS ? outilo.t('more', { n: users.length - MAX_ROWS }) : ''
}

function generate() {
  users = FakeUserLogic.generate({ count: state.count, lang: state.lang, seed: state.seed })
  renderTable()
  outilo.storage.set('state', state).catch(function () {})
}

async function save(ext, content) {
  var ok = await outilo.files.save('utilisateurs-fictifs.' + ext, content)
  if (ok) outilo.toast(outilo.t('saved'), 'success')
}

$('#fields').addEventListener('click', function (e) {
  var f = e.target.dataset && e.target.dataset.f
  if (!f) return
  var i = state.fields.indexOf(f)
  if (i >= 0 && state.fields.length > 1) state.fields.splice(i, 1)
  else if (i < 0) state.fields = FakeUserLogic.FIELDS.filter(function (x) { return x === f || state.fields.indexOf(x) >= 0 })
  renderFields()
  renderTable()
  outilo.storage.set('state', state).catch(function () {})
})
$('#count').addEventListener('change', function (e) { state.count = +e.target.value; generate() })
$('#lang').addEventListener('change', function (e) { state.lang = e.target.value; generate() })
$('#seed').addEventListener('change', function (e) { state.seed = e.target.value.trim(); generate() })
$('#gen').addEventListener('click', generate)
$('#copyJson').addEventListener('click', async function () {
  await outilo.clipboard.write(FakeUserLogic.toJSON(users, state.fields))
  outilo.toast(outilo.t('copied'), 'success')
})
$('#saveJson').addEventListener('click', function () { save('json', FakeUserLogic.toJSON(users, state.fields)) })
$('#saveCsv').addEventListener('click', function () { save('csv', FakeUserLogic.toCSV(users, state.fields)) })
$('#saveSql').addEventListener('click', function () { save('sql', FakeUserLogic.toSQL(users, state.fields, $('#table').value)) })

outilo.onLocale(function () { renderFields(); renderTable() })
outilo.onCommand(async function (cmd) {
  if (cmd !== 'copy-one') return
  var one = FakeUserLogic.generate({ count: 1, lang: state.lang })
  await outilo.clipboard.write(FakeUserLogic.toJSON(one, FakeUserLogic.FIELDS))
  outilo.toast(outilo.t('copied'), 'success')
})

outilo.ready.then(async function () {
  var saved = null
  try {
    saved = await outilo.storage.get('state')
    if (saved && Array.isArray(saved.fields)) Object.assign(state, saved)
  } catch (e) { /* première utilisation */ }
  if (!saved) state.lang = outilo.locale === 'en' ? 'en' : 'fr'
  $('#count').value = String(state.count)
  $('#lang').value = state.lang
  $('#seed').value = state.seed
  renderFields()
  generate()
})
