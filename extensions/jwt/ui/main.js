/* global outilo, JwtLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'JWT & Base64', subtitle: 'Tout est décodé localement : vos jetons ne quittent pas la machine.',
    token: 'Jeton', tokenHint: 'Collez un JWT…', verify: 'Vérifier la signature (HS256/384/512)', secret: 'Secret',
    verifyBtn: 'Vérifier', copy: 'Copier', plain: 'Texte', urlSafe: 'Variante URL (sans + / =)', copied: 'Copié',
    errParts: 'Un JWT contient trois parties séparées par des points.', errJson: 'En-tête ou payload illisible.',
    valid: '✓ Jeton valide (non expiré)', expired: '✗ Jeton expiré', notYet: '⏳ Pas encore valide (nbf)',
    none: 'Pas de date d’expiration', sigOk: '✓ Signature valide', sigBad: '✗ Signature invalide',
    sigAlg: 'Algorithme non pris en charge (HMAC uniquement)', b64Err: 'Base64 invalide ou texte non UTF-8',
    exp: 'Expire', iat: 'Émis', nbf: 'Valide à partir de', in: 'dans {t}', ago: 'il y a {t}'
  },
  en: {
    title: 'JWT & Base64', subtitle: 'Everything is decoded locally: your tokens never leave the machine.',
    token: 'Token', tokenHint: 'Paste a JWT…', verify: 'Verify signature (HS256/384/512)', secret: 'Secret',
    verifyBtn: 'Verify', copy: 'Copy', plain: 'Text', urlSafe: 'URL-safe variant (no + / =)', copied: 'Copied',
    errParts: 'A JWT has three dot-separated parts.', errJson: 'Unreadable header or payload.',
    valid: '✓ Valid token (not expired)', expired: '✗ Expired token', notYet: '⏳ Not valid yet (nbf)',
    none: 'No expiration date', sigOk: '✓ Valid signature', sigBad: '✗ Invalid signature',
    sigAlg: 'Unsupported algorithm (HMAC only)', b64Err: 'Invalid Base64 or non-UTF-8 text',
    exp: 'Expires', iat: 'Issued', nbf: 'Not before', in: 'in {t}', ago: '{t} ago'
  }
}

var $ = function (s) { return document.querySelector(s) }
var current = null

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] })
}

function relative(sec) {
  var diff = sec - Date.now() / 1000
  var abs = Math.abs(diff)
  var units = [[86400, outilo.locale === 'en' ? 'd' : 'j'], [3600, 'h'], [60, 'min'], [1, 's']]
  for (var i = 0; i < units.length; i++) {
    if (abs >= units[i][0] || i === units.length - 1) {
      var t = Math.floor(abs / units[i][0]) + ' ' + units[i][1]
      return outilo.t(diff >= 0 ? 'in' : 'ago', { t: t })
    }
  }
}

function renderJwt() {
  var raw = $('#token').value.trim()
  $('#sigStatus').textContent = ''
  current = null
  if (!raw) {
    $('#header').textContent = $('#payload').textContent = '—'
    $('#jwtStatus').textContent = ''
    $('#claims').innerHTML = ''
    return
  }
  try {
    current = JwtLogic.decodeJwt(raw)
  } catch (e) {
    $('#header').textContent = $('#payload').textContent = '—'
    $('#claims').innerHTML = ''
    $('#jwtStatus').className = 'status o-err'
    $('#jwtStatus').textContent = outilo.t(e.message === 'parts' ? 'errParts' : 'errJson')
    return
  }
  $('#header').textContent = JSON.stringify(current.header, null, 2)
  $('#payload').textContent = JSON.stringify(current.payload, null, 2)
  var status = JwtLogic.timeStatus(current.payload, Date.now() / 1000)
  $('#jwtStatus').className = 'status ' + (status === 'valid' ? 'o-ok' : status === 'none' ? '' : 'o-err')
  $('#jwtStatus').textContent = outilo.t(status)
  $('#claims').innerHTML = ['exp', 'iat', 'nbf']
    .filter(function (k) { return typeof current.payload[k] === 'number' })
    .map(function (k) {
      var d = new Date(current.payload[k] * 1000)
      return '<tr><td>' + esc(outilo.t(k)) + '</td><td>' + esc(d.toLocaleString(outilo.locale)) + '</td><td>' +
        esc(relative(current.payload[k])) + '</td></tr>'
    })
    .join('')
}

async function verify() {
  if (!current) return
  try {
    var ok = await JwtLogic.verifyHmac($('#token').value, $('#secret').value)
    $('#sigStatus').className = 'status ' + (ok ? 'o-ok' : 'o-err')
    $('#sigStatus').textContent = outilo.t(ok ? 'sigOk' : 'sigBad')
  } catch (e) {
    $('#sigStatus').className = 'status o-err'
    $('#sigStatus').textContent = outilo.t('sigAlg')
  }
}

function encode() {
  $('#encoded').value = JwtLogic.encodeBase64($('#plain').value, $('#urlSafe').checked)
  $('#b64Err').textContent = ''
}

function decode() {
  try {
    $('#plain').value = JwtLogic.decodeBase64($('#encoded').value)
    $('#b64Err').textContent = ''
  } catch (e) {
    $('#b64Err').textContent = $('#encoded').value.trim() ? outilo.t('b64Err') : ''
  }
}

function showTab(name) {
  document.querySelectorAll('#tabs .o-chip').forEach(function (c) { c.classList.toggle('on', c.dataset.tab === name) })
  $('#jwt').classList.toggle('hidden', name !== 'jwt')
  $('#b64').classList.toggle('hidden', name !== 'b64')
}

document.querySelectorAll('#tabs .o-chip').forEach(function (c) {
  c.addEventListener('click', function () { showTab(c.dataset.tab) })
})
document.querySelectorAll('[data-copy]').forEach(function (b) {
  b.addEventListener('click', async function () {
    var el = $('#' + b.dataset.copy)
    var text = 'value' in el ? el.value : el.textContent
    if (!text || text === '—') return
    await outilo.clipboard.write(text)
    outilo.toast(outilo.t('copied'), 'success')
  })
})
$('#token').addEventListener('input', renderJwt)
$('#verify').addEventListener('click', verify)
$('#secret').addEventListener('keydown', function (e) { if (e.key === 'Enter') verify() })
$('#plain').addEventListener('input', encode)
$('#encoded').addEventListener('input', decode)
$('#urlSafe').addEventListener('change', encode)

outilo.onLocale(renderJwt)
outilo.onCommand(function (cmd) { if (cmd === 'base64') { showTab('b64'); $('#plain').focus() } })
outilo.ready.then(renderJwt)
