/* global outilo, HashLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Hash', subtitle: 'Empreintes MD5, SHA et HMAC d’un texte ou d’un fichier, et mots de passe bcrypt.',
    text: 'Texte', file: 'Fichier', format: 'Format', textHint: 'Texte à hacher…',
    drop: 'Déposez un fichier ici ou cliquez pour le choisir', keyHint: 'Clé HMAC (facultative)',
    expectedHint: 'Empreinte attendue, pour vérifier', cost: 'Coût', bPass: 'Mot de passe', bGen: 'Générer',
    bCheck: 'Vérifier', copy: 'Copier', copied: 'Copié', match: '✓ Correspond à {algo}', noMatch: '✗ Aucune empreinte ne correspond',
    bOk: '✓ Le mot de passe correspond', bKo: '✗ Le mot de passe ne correspond pas', bWait: 'Calcul en cours…',
    fileInfo: '{name} — {size} octets', tooBig: 'Fichier trop volumineux (500 Mo maximum)', hmac: 'HMAC'
  },
  en: {
    title: 'Hash', subtitle: 'MD5, SHA and HMAC digests of a text or a file, and bcrypt passwords.',
    text: 'Text', file: 'File', format: 'Format', textHint: 'Text to hash…',
    drop: 'Drop a file here or click to choose one', keyHint: 'HMAC key (optional)',
    expectedHint: 'Expected digest, to verify', cost: 'Cost', bPass: 'Password', bGen: 'Generate',
    bCheck: 'Verify', copy: 'Copy', copied: 'Copied', match: '✓ Matches {algo}', noMatch: '✗ No digest matches',
    bOk: '✓ Password matches', bKo: '✗ Password does not match', bWait: 'Computing…',
    fileInfo: '{name} — {size} bytes', tooBig: 'File too large (500 MB max)', hmac: 'HMAC'
  }
}

var $ = function (s) { return document.querySelector(s) }
var source = 'text'
var fileBytes = null
var results = {}
var run = 0

function bytes() {
  return source === 'file' ? fileBytes : new TextEncoder().encode($('#text').value)
}

function fmt(buf) {
  var f = $('#format').value
  if (f === 'b64') return HashLogic.base64(buf)
  var h = HashLogic.hex(buf)
  return f === 'HEX' ? h.toUpperCase() : h
}

async function compute() {
  var id = ++run
  var data = bytes()
  var key = $('#key').value
  var tbody = $('#rows')
  if (!data) { tbody.innerHTML = ''; results = {}; verify(); return }
  var keyBytes = new TextEncoder().encode(key)
  var out = {}
  for (var i = 0; i < HashLogic.algos.length; i++) {
    var algo = HashLogic.algos[i]
    if (key && algo === 'MD5') continue
    var buf = key ? await HashLogic.hmac(algo, keyBytes, data) : await HashLogic.digest(algo, data)
    out[(key ? 'HMAC-' : '') + algo] = fmt(buf)
  }
  if (id !== run) return
  results = out
  tbody.innerHTML = ''
  Object.keys(out).forEach(function (algo) {
    var tr = document.createElement('tr')
    tr.dataset.algo = algo
    var a = document.createElement('td'); a.className = 'algo'; a.textContent = algo
    var v = document.createElement('td'); v.className = 'val'; v.textContent = out[algo]
    var c = document.createElement('td')
    var btn = document.createElement('button'); btn.className = 'o-btn o-btn--sm'; btn.textContent = outilo.t('copy')
    btn.addEventListener('click', function () { copy(out[algo]) })
    c.appendChild(btn)
    tr.append(a, v, c)
    tbody.appendChild(tr)
  })
  verify()
}

function verify() {
  var expected = $('#expected').value
  var found = null
  document.querySelectorAll('#rows tr').forEach(function (tr) {
    var hit = HashLogic.same(expected, results[tr.dataset.algo]) ||
      (expected && HashLogic.same(expected.toLowerCase(), String(results[tr.dataset.algo]).toLowerCase()))
    tr.classList.toggle('match', !!hit)
    if (hit && !found) found = tr.dataset.algo
  })
  var v = $('#verdict')
  v.textContent = !expected.trim() ? '' : found ? outilo.t('match', { algo: found }) : outilo.t('noMatch')
  v.className = 'o-sub ' + (found ? 'o-ok' : 'o-err')
}

async function copy(text) {
  await outilo.clipboard.write(text)
  outilo.toast(outilo.t('copied'), 'success')
}

function setSource(s) {
  source = s
  document.querySelectorAll('[data-src]').forEach(function (b) { b.classList.toggle('on', b.dataset.src === s) })
  $('#text').classList.toggle('hidden', s !== 'text')
  $('#drop').classList.toggle('hidden', s !== 'file')
  compute()
}

function loadFile(f) {
  if (!f) return
  if (f.size > 500 * 1024 * 1024) return outilo.toast(outilo.t('tooBig'), 'error')
  f.arrayBuffer().then(function (buf) {
    fileBytes = new Uint8Array(buf)
    $('#dropText').textContent = outilo.t('fileInfo', { name: f.name, size: f.size.toLocaleString(outilo.locale) })
    compute()
  })
}

document.querySelectorAll('[data-src]').forEach(function (b) { b.addEventListener('click', function () { setSource(b.dataset.src) }) })
$('#text').addEventListener('input', compute)
$('#key').addEventListener('input', compute)
$('#format').addEventListener('change', compute)
$('#expected').addEventListener('input', verify)
$('#file').addEventListener('change', function () { loadFile(this.files[0]); this.value = '' })
var drop = $('#drop')
drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over') })
drop.addEventListener('dragleave', function () { drop.classList.remove('over') })
drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); loadFile(e.dataTransfer.files[0]) })

$('#bGen').addEventListener('click', async function () {
  $('#bOut').textContent = outilo.t('bWait')
  $('#bOut').className = 'o-sub'
  $('#bHash').value = await HashLogic.bcryptHash($('#bPass').value, +$('#cost').value)
  $('#bOut').textContent = ''
})
$('#bCheck').addEventListener('click', async function () {
  $('#bOut').textContent = outilo.t('bWait')
  var ok = await HashLogic.bcryptCompare($('#bPass').value, $('#bHash').value.trim())
  $('#bOut').textContent = outilo.t(ok ? 'bOk' : 'bKo')
  $('#bOut').className = 'o-sub ' + (ok ? 'o-ok' : 'o-err')
})
$('#bCopy').addEventListener('click', function () { if ($('#bHash').value) copy($('#bHash').value) })

outilo.onLocale(function () { compute() })
outilo.ready.then(function () { setSource('text'); $('#text').focus() })
