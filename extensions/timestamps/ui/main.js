/* global outilo, TsLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Timestamps', subtitle: 'Unix ⇄ date lisible, ISO 8601, RFC 2822, fuseaux horaires.',
    nowUnix: 'Maintenant (Unix)', nowMs: 'Millisecondes', zone: 'Fuseau', now: 'Maintenant', zones: 'Autres fuseaux',
    offset: 'Décalage', inputHint: '1761400000, 1761400000000, 2026-10-25T18:00:00Z, now…', invalid: 'Date non reconnue',
    copy: 'Copier', copied: 'Copié', local: 'Fuseau de ce PC',
    unix: 'Unix (secondes)', unixMs: 'Unix (millisecondes)', iso: 'ISO 8601 (UTC)', isoLocal: 'ISO 8601 (fuseau choisi)',
    rfc: 'RFC 2822 / HTTP', relative: 'Relatif', week: 'Semaine ISO · jour de l’année',
    formatter: 'Formater une date (code JavaScript)', copyCode: 'Copier le code',
    tokens: 'Jetons : YYYY YY MMMM MMM MM M DD D dddd ddd HH H hh h mm ss SSS A Z ; [texte] est recopié tel quel.'
  },
  en: {
    title: 'Timestamps', subtitle: 'Unix ⇄ readable date, ISO 8601, RFC 2822, time zones.',
    nowUnix: 'Now (Unix)', nowMs: 'Milliseconds', zone: 'Time zone', now: 'Now', zones: 'Other time zones',
    offset: 'Offset', inputHint: '1761400000, 1761400000000, 2026-10-25T18:00:00Z, now…', invalid: 'Unrecognized date',
    copy: 'Copy', copied: 'Copied', local: 'This PC’s time zone',
    unix: 'Unix (seconds)', unixMs: 'Unix (milliseconds)', iso: 'ISO 8601 (UTC)', isoLocal: 'ISO 8601 (selected zone)',
    rfc: 'RFC 2822 / HTTP', relative: 'Relative', week: 'ISO week · day of year',
    formatter: 'Format a date (JavaScript code)', copyCode: 'Copy code',
    tokens: 'Tokens: YYYY YY MMMM MMM MM M DD D dddd ddd HH H hh h mm ss SSS A Z; [text] is kept as is.'
  }
}

var $ = function (s) { return document.querySelector(s) }
var LOCAL = Intl.DateTimeFormat().resolvedOptions().timeZone
var OTHERS = ['UTC', 'Europe/Paris', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney']

function zones() {
  try { return Intl.supportedValuesOf('timeZone') } catch (e) { return OTHERS }
}

async function copy(text) {
  await outilo.clipboard.write(text)
  outilo.toast(outilo.t('copied'), 'success')
}

function row(label, value) {
  var tr = document.createElement('tr')
  var k = document.createElement('td'); k.className = 'k'; k.textContent = label
  var v = document.createElement('td'); v.className = 'v'; v.textContent = value
  var c = document.createElement('td'); c.className = 'c'
  var b = document.createElement('button'); b.className = 'o-btn o-btn--sm'; b.textContent = outilo.t('copy')
  b.addEventListener('click', function () { copy(value) })
  c.appendChild(b)
  tr.append(k, v, c)
  return tr
}

function render() {
  var date = TsLogic.parse($('#input').value)
  var rows = $('#rows')
  var zoneRows = $('#zones')
  rows.innerHTML = ''
  zoneRows.innerHTML = ''
  $('#status').textContent = date || !$('#input').value.trim() ? '' : outilo.t('invalid')
  $('#status').className = 'o-sub o-err'
  if (!date) return
  var tz = $('#zone').value
  TsLogic.formats(date, Date.now(), outilo.locale, tz).forEach(function (f) { rows.appendChild(row(outilo.t(f.id), f.value)) })
  OTHERS.filter(function (z) { return z !== tz }).forEach(function (z) {
    var tr = row(z, new Intl.DateTimeFormat(outilo.locale, { dateStyle: 'medium', timeStyle: 'medium', timeZone: z }).format(date))
    var off = document.createElement('td'); off.className = 'c'; off.textContent = TsLogic.offset(date, z)
    tr.insertBefore(off, tr.lastChild)
    zoneRows.appendChild(tr)
  })
}

function renderPattern() {
  var date = TsLogic.parse($('#input').value) || new Date()
  var pattern = $('#pattern').value
  $('#patternOut').textContent = TsLogic.formatPattern(date, pattern, outilo.locale)
  $('#code').textContent = TsLogic.codeFor(pattern).replace("locale = 'fr-FR'", "locale = '" + (outilo.locale === 'en' ? 'en-US' : 'fr-FR') + "'")
}

function tick() {
  var n = Date.now()
  $('#nowUnix').textContent = Math.floor(n / 1000)
  $('#nowMs').textContent = n
  $('#nowIso').textContent = new Date(n).toISOString().replace(/\.\d+Z$/, 'Z')
}

function fillZones() {
  var sel = $('#zone')
  var current = sel.value || LOCAL
  sel.innerHTML = ''
  var first = document.createElement('option')
  first.value = LOCAL
  first.textContent = LOCAL + ' — ' + outilo.t('local')
  sel.appendChild(first)
  zones().filter(function (z) { return z !== LOCAL }).forEach(function (z) {
    var o = document.createElement('option'); o.value = z; o.textContent = z; sel.appendChild(o)
  })
  sel.value = current
}

document.querySelectorAll('#now [data-copy]').forEach(function (el) {
  el.addEventListener('click', function () { copy(el.querySelector('strong').textContent) })
})
$('#input').addEventListener('input', function () { render(); renderPattern() })
$('#pattern').addEventListener('input', renderPattern)
$('#patterns').addEventListener('change', function () { if (this.value) { $('#pattern').value = this.value; this.value = ''; renderPattern() } })
$('#copyCode').addEventListener('click', function () { copy($('#code').textContent) })
$('#zone').addEventListener('change', render)
$('#nowBtn').addEventListener('click', function () { $('#input').value = String(Math.floor(Date.now() / 1000)); render() })

outilo.onLocale(function () { fillZones(); render(); renderPattern() })
outilo.ready.then(function () {
  fillZones()
  tick()
  setInterval(tick, 1000)
  $('#input').value = String(Math.floor(Date.now() / 1000))
  render()
  renderPattern()
  $('#input').focus()
})
