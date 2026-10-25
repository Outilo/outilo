/* global outilo, UuidLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'UUID & identifiants', subtitle: 'Identifiants uniques générés avec un aléa cryptographique.',
    count: 'Nombre', upper: 'Majuscules', noHyphens: 'Sans tirets', size: 'Longueur', copyAll: 'Tout copier',
    generate: 'Générer', copied: 'Copié', inspect: 'Lire l’horodatage d’un UUID v7 ou d’un ULID',
    noTime: 'Pas d’horodatage (seuls les UUID v7 et les ULID en contiennent)',
    v4: 'Totalement aléatoire (122 bits). Le choix par défaut.',
    v7: 'Commence par l’horodatage : triable, idéal comme clé primaire de base de données.',
    ulid: '26 caractères lisibles, triables dans le temps, sans caractères ambigus.',
    nanoid: 'Court et compatible URL (A-Z a-z 0-9 _ -).'
  },
  en: {
    title: 'UUID & IDs', subtitle: 'Unique identifiers generated with cryptographic randomness.',
    count: 'Count', upper: 'Uppercase', noHyphens: 'No hyphens', size: 'Length', copyAll: 'Copy all',
    generate: 'Generate', copied: 'Copied', inspect: 'Read the timestamp of a UUID v7 or ULID',
    noTime: 'No timestamp (only UUID v7 and ULID contain one)',
    v4: 'Fully random (122 bits). The default choice.',
    v7: 'Starts with a timestamp: sortable, great as a database primary key.',
    ulid: '26 readable characters, time-sortable, no ambiguous characters.',
    nanoid: 'Short and URL-friendly (A-Z a-z 0-9 _ -).'
  }
}

var $ = function (s) { return document.querySelector(s) }
var kind = 'v4'

function opts() {
  return { upper: $('#upper').checked, noHyphens: $('#noHyphens').checked, size: Math.max(6, Math.min(64, +$('#size').value || 21)) }
}

function generate() {
  var n = +$('#count').value
  var o = opts()
  var lines = []
  for (var i = 0; i < n; i++) lines.push(UuidLogic.make(kind, o))
  $('#out').textContent = lines.join('\n')
}

function setKind(k) {
  kind = k
  document.querySelectorAll('#kinds .o-chip').forEach(function (c) { c.classList.toggle('on', c.dataset.kind === k) })
  $('#uuidOpts').classList.toggle('hidden', k !== 'v4' && k !== 'v7')
  $('#sizeOpt').classList.toggle('hidden', k !== 'nanoid')
  $('#desc').textContent = outilo.t(k)
  generate()
}

async function copy(text) {
  await outilo.clipboard.write(text)
  outilo.toast(outilo.t('copied'), 'success')
}

function inspect() {
  var v = $('#inspect').value
  if (!v.trim()) return ($('#inspectOut').textContent = '')
  var ms = UuidLogic.timestampOf(v)
  $('#inspectOut').textContent = ms == null ? outilo.t('noTime') : new Date(ms).toLocaleString(outilo.locale) + ' (' + new Date(ms).toISOString() + ')'
}

document.querySelectorAll('#kinds .o-chip').forEach(function (c) {
  c.addEventListener('click', function () { setKind(c.dataset.kind) })
})
;['#count', '#upper', '#noHyphens', '#size'].forEach(function (s) { $(s).addEventListener('change', generate) })
$('#gen').addEventListener('click', generate)
$('#copy').addEventListener('click', function () { copy($('#out').textContent) })
$('#inspect').addEventListener('input', inspect)

outilo.onLocale(function () { $('#desc').textContent = outilo.t(kind); inspect() })
outilo.onCommand(function (cmd) {
  if (cmd === 'copy-v4') copy(UuidLogic.v4())
  if (cmd === 'copy-v7') copy(UuidLogic.v7())
})
outilo.ready.then(function () { setKind('v4') })
