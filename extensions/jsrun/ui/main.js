/* global outilo, JsRunLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'JavaScript', subtitle: 'Exécutez du JavaScript dans un cadre isolé, sans réseau. « await » est permis.',
    run: 'Exécuter (Ctrl+Entrée)', clear: 'Effacer la console', examples: 'Exemples…', done: 'Terminé en {ms} ms',
    returned: '← {v}', ex1: 'Bases', ex2: 'Tableaux et objets', ex3: 'Dates et Intl', ex4: 'Asynchrone',
    hint: 'Astuce : une boucle infinie bloque l’outil ; rechargez alors l’onglet (palette → « Recharger l’onglet actif »).'
  },
  en: {
    title: 'JavaScript', subtitle: 'Run JavaScript in an isolated frame, without network. “await” is allowed.',
    run: 'Run (Ctrl+Enter)', clear: 'Clear console', examples: 'Examples…', done: 'Done in {ms} ms',
    returned: '← {v}', ex1: 'Basics', ex2: 'Arrays and objects', ex3: 'Dates and Intl', ex4: 'Async',
    hint: 'Tip: an infinite loop freezes the tool; reload the tab (palette → “Reload active tab”).'
  }
}

var EXAMPLES = {
  ex1: 'const nom = "Outilo"\nconsole.log(`Bonjour ${nom} !`)\nreturn 6 * 7',
  ex2: 'const outils = [\n  { nom: "JSON", cat: "code" },\n  { nom: "Couleurs", cat: "design" },\n  { nom: "Hash", cat: "code" }\n]\nconsole.table?.(outils)\nconst parCat = Object.groupBy(outils, o => o.cat)\nconsole.log(parCat)\nreturn outils.map(o => o.nom).sort()',
  ex3: 'const d = new Date()\nconsole.log(d.toISOString())\nconsole.log(new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(d))\nconsole.log(new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(1234.5))',
  ex4: 'const pause = ms => new Promise(r => setTimeout(r, ms))\nconsole.log("Début")\nawait pause(500)\nconsole.log("Après 500 ms")\nreturn "fini"'
}

var $ = function (s) { return document.querySelector(s) }
var runId = 0
var started = 0
var original = {}

function line(text, cls) {
  var d = document.createElement('div')
  d.className = 'line ' + (cls || '')
  d.textContent = text
  $('#out').appendChild(d)
  $('#out').scrollTop = $('#out').scrollHeight
}

// Console capturée : les appels du code exécuté s'affichent dans le panneau
;['log', 'info', 'warn', 'error', 'debug'].forEach(function (k) {
  original[k] = console[k]
  console[k] = function () {
    line(JsRunLogic.format(arguments), k === 'warn' ? 'warn' : k === 'error' ? 'error' : '')
    original[k].apply(console, arguments)
  }
})
console.table = function (rows) { line(JsRunLogic.inspect(rows)) }
window.addEventListener('error', function (e) { line(e.message, 'error') })
window.addEventListener('unhandledrejection', function (e) { line('Promise : ' + JsRunLogic.inspect(e.reason), 'error') })

window.__jsrunDone = function (id, value, error) {
  if (id !== runId) return
  if (error) line(JsRunLogic.inspect(error), 'error')
  else if (value !== undefined) line(outilo.t('returned', { v: JsRunLogic.inspect(value) }), 'result')
  $('#time').textContent = outilo.t('done', { ms: Math.round(performance.now() - started) })
}

function run() {
  runId++
  started = performance.now()
  $('#time').textContent = ''
  line('▶ ' + new Date().toLocaleTimeString(outilo.locale), 'muted')
  // Le script est injecté en ligne (CSP des extensions : 'unsafe-inline', sans eval)
  var s = document.createElement('script')
  s.textContent = JsRunLogic.wrap($('#code').value, runId)
  document.body.appendChild(s)
  s.remove()
  outilo.storage.set('code', $('#code').value.slice(0, 200000)).catch(function () {})
}

function examples() {
  var sel = $('#examples')
  sel.length = 1
  Object.keys(EXAMPLES).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = outilo.t(k); sel.appendChild(o) })
}

$('#run').addEventListener('click', run)
$('#clear').addEventListener('click', function () { $('#out').innerHTML = ''; line(outilo.t('hint'), 'muted') })
$('#code').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run() }
  if (e.key === 'Tab') {
    e.preventDefault()
    var el = e.target
    var p = el.selectionStart
    el.value = el.value.slice(0, p) + '  ' + el.value.slice(el.selectionEnd)
    el.selectionStart = el.selectionEnd = p + 2
  }
})
$('#examples').addEventListener('change', function () { if (this.value) { $('#code').value = EXAMPLES[this.value]; this.value = '' } })

outilo.onLocale(examples)
outilo.ready.then(async function () {
  examples()
  var saved = null
  try { saved = await outilo.storage.get('code') } catch (e) { /* aucun stockage */ }
  $('#code').value = saved || EXAMPLES.ex1
  line(outilo.t('hint'), 'muted')
  $('#code').focus()
})
