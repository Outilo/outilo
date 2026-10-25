/* global outilo, JsonLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'JSON', subtitle: 'Collez du JSON (ou du YAML) : il est validé à la frappe.',
    format: 'Formater', minify: 'Minifier', toYaml: 'JSON → YAML', fromYaml: 'YAML → JSON', indent: 'Indentation',
    tab: 'Tabulation', sort: 'Trier les clés', placeholder: '{"bonjour": "le monde"}', sample: 'Exemple', clear: 'Effacer',
    save: 'Enregistrer', copy: 'Copier le résultat', copied: 'Copié', valid: '✓ Valide — {nodes} nœuds, profondeur {depth}',
    invalid: '✗ {error}', at: ' (ligne {line}, colonne {col})', empty: 'En attente de texte…', saved: 'Fichier enregistré'
  },
  en: {
    title: 'JSON', subtitle: 'Paste JSON (or YAML): it is validated as you type.',
    format: 'Format', minify: 'Minify', toYaml: 'JSON → YAML', fromYaml: 'YAML → JSON', indent: 'Indent',
    tab: 'Tab', sort: 'Sort keys', placeholder: '{"hello": "world"}', sample: 'Sample', clear: 'Clear',
    save: 'Save', copy: 'Copy result', copied: 'Copied', valid: '✓ Valid — {nodes} nodes, depth {depth}',
    invalid: '✗ {error}', at: ' (line {line}, column {col})', empty: 'Waiting for text…', saved: 'File saved'
  }
}

var $ = function (s) { return document.querySelector(s) }
var mode = 'format'
var result = ''
var saveTimer

var SAMPLE = {
  outil: 'Outilo', version: '1.0.0', gratuit: true, extensions: ['json', 'hash', 'regex'],
  auteur: { nom: 'Équipe Outilo', site: null }, note: 4.8
}

function render() {
  var text = $('#input').value
  var status = $('#status')
  if (!text.trim()) {
    result = ''
    $('#output').textContent = ''
    status.className = 'status'
    status.textContent = outilo.t('empty')
    return
  }
  var parsed = mode === 'fromYaml' ? JsonLogic.fromYaml(text) : JsonLogic.parse(text)
  if (!parsed.ok) {
    result = ''
    $('#output').textContent = ''
    status.className = 'status o-err'
    status.textContent = outilo.t('invalid', { error: parsed.error }) + (parsed.line ? outilo.t('at', { line: parsed.line, col: parsed.col }) : '')
    return
  }
  var value = $('#sort').checked ? JsonLogic.sortKeys(parsed.value) : parsed.value
  var indent = $('#indent').value
  if (mode === 'minify') result = JsonLogic.minify(value)
  else if (mode === 'yaml') result = JsonLogic.toYaml(value)
  else result = JsonLogic.format(value, indent)
  $('#output').textContent = result
  status.className = 'status o-ok'
  status.textContent = outilo.t('valid', JsonLogic.stats(value))
}

function setMode(m) {
  mode = m
  document.querySelectorAll('#modes .o-chip').forEach(function (c) { c.classList.toggle('on', c.dataset.mode === m) })
  render()
}

function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(function () {
    var text = $('#input').value
    if (text.length < 200000) outilo.storage.set('input', text).catch(function () {})
    outilo.storage.set('prefs', { mode: mode, indent: $('#indent').value, sort: $('#sort').checked }).catch(function () {})
  }, 500)
}

async function copy() {
  if (!result) return
  await outilo.clipboard.write(result)
  outilo.toast(outilo.t('copied'), 'success')
}

async function save() {
  if (!result) return
  var ext = mode === 'yaml' ? 'yaml' : 'json'
  if (await outilo.files.save('donnees.' + ext, result)) outilo.toast(outilo.t('saved'), 'success')
}

document.querySelectorAll('#modes .o-chip').forEach(function (c) {
  c.addEventListener('click', function () { setMode(c.dataset.mode); persist() })
})
$('#input').addEventListener('input', function () { render(); persist() })
$('#indent').addEventListener('change', function () { render(); persist() })
$('#sort').addEventListener('change', function () { render(); persist() })
$('#copy').addEventListener('click', copy)
$('#save').addEventListener('click', save)
$('#clear').addEventListener('click', function () { $('#input').value = ''; render(); persist(); $('#input').focus() })
$('#sample').addEventListener('click', function () {
  $('#input').value = JSON.stringify(SAMPLE)
  setMode(mode === 'fromYaml' ? 'format' : mode)
  persist()
})

outilo.onLocale(render)
outilo.onCommand(function (cmd) {
  if (cmd === 'format') setMode('format')
  if (cmd === 'minify') setMode('minify')
})

outilo.ready.then(async function () {
  try {
    var prefs = await outilo.storage.get('prefs')
    if (prefs) {
      mode = prefs.mode || mode
      $('#indent').value = prefs.indent || '2'
      $('#sort').checked = !!prefs.sort
    }
    $('#input').value = (await outilo.storage.get('input')) || ''
  } catch (e) { /* stockage indisponible : on démarre vide */ }
  setMode(mode)
  $('#input').focus()
})
