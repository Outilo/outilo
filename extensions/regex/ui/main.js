/* global outilo, RegexLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Regex', subtitle: 'Testez une expression régulière JavaScript : correspondances surlignées, groupes, remplacement.',
    fg: 'global : toutes les correspondances', fi: 'insensible à la casse', fm: 'multiligne : ^ et $ par ligne',
    fs: 'dotAll : . inclut les retours à la ligne', fu: 'unicode', fy: 'sticky : à partir de lastIndex',
    library: 'Bibliothèque', pick: '— Choisir —', text: 'Texte à tester', preview: 'Correspondances', match: 'Correspondance',
    groups: 'Groupes', replaceHint: 'Remplacement, ex. $1 ou $<nom>', copyRe: 'Copier la regex', copyOut: 'Copier le résultat',
    copied: 'Copié', count: '{n} correspondance(s)', limit: ' (limite de {max} atteinte)', none: 'Aucune correspondance',
    email: 'Adresse e-mail', url: 'URL', ipv4: 'Adresse IPv4', isoDate: 'Date ISO (groupes nommés)', phoneFr: 'Téléphone français',
    postalFr: 'Code postal français', hexColor: 'Couleur hexadécimale', uuid: 'UUID', semver: 'Version SemVer',
    strongPassword: 'Mot de passe robuste (12+, 4 types)'
  },
  en: {
    title: 'Regex', subtitle: 'Test a JavaScript regular expression: highlighted matches, groups, replacement.',
    fg: 'global: all matches', fi: 'case-insensitive', fm: 'multiline: ^ and $ per line',
    fs: 'dotAll: . matches newlines', fu: 'unicode', fy: 'sticky: from lastIndex',
    library: 'Library', pick: '— Pick —', text: 'Test text', preview: 'Matches', match: 'Match',
    groups: 'Groups', replaceHint: 'Replacement, e.g. $1 or $<name>', copyRe: 'Copy regex', copyOut: 'Copy result',
    copied: 'Copied', count: '{n} match(es)', limit: ' (limit of {max} reached)', none: 'No match',
    email: 'Email address', url: 'URL', ipv4: 'IPv4 address', isoDate: 'ISO date (named groups)', phoneFr: 'French phone number',
    postalFr: 'French postal code', hexColor: 'Hex color', uuid: 'UUID', semver: 'SemVer version',
    strongPassword: 'Strong password (12+, 4 kinds)'
  }
}

var $ = function (s) { return document.querySelector(s) }
var timer
var lastOut = ''

function flags() { return $('#flagsText').value.replace(/[^dgimsuyv]/g, '') }

function syncChips() {
  var f = flags()
  document.querySelectorAll('#flags .o-chip').forEach(function (c) { c.classList.toggle('on', f.indexOf(c.dataset.f) >= 0) })
}

function fillLibrary() {
  var sel = $('#library')
  var current = sel.value
  sel.length = 1
  RegexLogic.LIBRARY.forEach(function (e) {
    var o = document.createElement('option')
    o.value = e.id
    o.textContent = outilo.t(e.id)
    sel.appendChild(o)
  })
  sel.value = current
}

function render() {
  syncChips()
  var status = $('#status')
  var text = $('#text').value
  var preview = $('#preview')
  var rows = $('#rows')
  preview.textContent = ''
  rows.innerHTML = ''
  $('#replaced').textContent = ''
  lastOut = ''
  if (!$('#pattern').value) { status.textContent = ''; preview.textContent = text; return }
  var c = RegexLogic.compile($('#pattern').value, flags())
  if (!c.ok) { status.className = 'o-sub o-err'; status.textContent = c.error; return }
  var list = RegexLogic.matches(c.re, text)
  status.className = 'o-sub ' + (list.length ? 'o-ok' : '')
  status.textContent = list.length
    ? outilo.t('count', { n: list.length }) + (list.length >= RegexLogic.MAX_MATCHES ? outilo.t('limit', { max: RegexLogic.MAX_MATCHES }) : '')
    : outilo.t('none')
  RegexLogic.segments(text, list).forEach(function (s) {
    if (s.hit < 0) return preview.appendChild(document.createTextNode(s.text))
    var m = document.createElement('mark')
    if (s.hit % 2) m.className = 'alt'
    m.textContent = s.text
    preview.appendChild(m)
  })
  list.slice(0, 200).forEach(function (m, i) {
    var tr = document.createElement('tr')
    var groups = m.named
      ? Object.keys(m.named).map(function (k) { return k + ' = ' + m.named[k] })
      : m.groups.map(function (g, j) { return '$' + (j + 1) + ' = ' + (g === undefined ? '∅' : g) })
    ;[String(i + 1), m.match, groups.join('\n')].forEach(function (v, k) {
      var td = document.createElement('td')
      if (k) td.className = 'wrap'
      td.textContent = v
      tr.appendChild(td)
    })
    rows.appendChild(tr)
  })
  if ($('#replacement').value) {
    lastOut = RegexLogic.replace(c.re, text, $('#replacement').value)
    $('#replaced').textContent = lastOut
  }
}

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(function () {
    render()
    outilo.storage.set('state', { pattern: $('#pattern').value, flags: flags(), text: $('#text').value.slice(0, 50000), replacement: $('#replacement').value }).catch(function () {})
  }, 120)
}

async function copy(text) {
  if (!text) return
  await outilo.clipboard.write(text)
  outilo.toast(outilo.t('copied'), 'success')
}

document.querySelectorAll('#flags .o-chip').forEach(function (c) {
  c.addEventListener('click', function () {
    var f = flags()
    $('#flagsText').value = f.indexOf(c.dataset.f) >= 0 ? f.replace(c.dataset.f, '') : f + c.dataset.f
    schedule()
  })
})
;['#pattern', '#flagsText', '#text', '#replacement'].forEach(function (s) { $(s).addEventListener('input', schedule) })
$('#library').addEventListener('change', function () {
  var e = RegexLogic.LIBRARY.find(function (x) { return x.id === this.value }, this)
  if (!e) return
  $('#pattern').value = e.pattern
  $('#flagsText').value = e.flags
  $('#text').value = e.sample
  schedule()
})
$('#copyRe').addEventListener('click', function () { copy('/' + $('#pattern').value + '/' + flags()) })
$('#copyOut').addEventListener('click', function () { copy(lastOut) })

outilo.onLocale(function () { fillLibrary(); render() })
outilo.ready.then(async function () {
  fillLibrary()
  var s = null
  try { s = await outilo.storage.get('state') } catch (e) { /* aucun stockage */ }
  s = s || { pattern: '(?<annee>\\d{4})-(?<mois>\\d{2})', flags: 'g', text: 'Version du 2026-10, puis 2027-01.', replacement: '$<mois>/$<annee>' }
  $('#pattern').value = s.pattern || ''
  $('#flagsText').value = s.flags || ''
  $('#text').value = s.text || ''
  $('#replacement').value = s.replacement || ''
  render()
  $('#pattern').focus()
})
