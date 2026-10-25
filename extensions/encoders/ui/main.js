/* global outilo, EncLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Encodeurs', subtitle: 'Base64, URL, entités HTML, hexadécimal et échappements Unicode, en UTF-8.',
    hex: 'Hexadécimal', all: 'Encoder tous les caractères non ASCII', plain: 'Texte', encoded: 'Encodé',
    encode: 'Encoder →', decode: '← Décoder', file: 'Fichier → Base64…', copyPlain: 'Copier le texte',
    copyCoded: 'Copier l’encodé', copied: 'Copié', invalid: 'Entrée non décodable avec cet encodage',
    fileDone: '{name} : {size} octets encodés', tooBig: 'Fichier trop volumineux (10 Mo maximum)'
  },
  en: {
    title: 'Encoders', subtitle: 'Base64, URL, HTML entities, hexadecimal and Unicode escapes, in UTF-8.',
    hex: 'Hexadecimal', all: 'Encode every non-ASCII character', plain: 'Text', encoded: 'Encoded',
    encode: 'Encode →', decode: '← Decode', file: 'File → Base64…', copyPlain: 'Copy text',
    copyCoded: 'Copy encoded', copied: 'Copied', invalid: 'Input cannot be decoded with this encoding',
    fileDone: '{name}: {size} bytes encoded', tooBig: 'File too large (10 MB max)'
  }
}

var $ = function (s) { return document.querySelector(s) }
var codec = 'base64'
var last = 'plain'

function status(text, error) {
  $('#status').textContent = text || ''
  $('#status').className = 'o-sub' + (error ? ' o-err' : '')
}

function encode() {
  last = 'plain'
  var r = EncLogic.run(codec, 'encode', $('#plain').value, { all: $('#all').checked })
  $('#coded').value = r.ok ? r.value : ''
  status(r.ok ? '' : outilo.t('invalid'), !r.ok)
}

function decode() {
  last = 'coded'
  var r = EncLogic.run(codec, 'decode', $('#coded').value)
  if (r.ok) $('#plain').value = r.value
  status(r.ok ? '' : outilo.t('invalid'), !r.ok)
}

function setCodec(c) {
  codec = c
  document.querySelectorAll('#codecs .o-chip').forEach(function (b) { b.classList.toggle('on', b.dataset.codec === c) })
  $('#allOpt').classList.toggle('hidden', c !== 'html')
  $('#fileBtn').classList.toggle('hidden', c !== 'base64')
  last === 'coded' ? decode() : encode()
  outilo.storage.set('codec', c).catch(function () {})
}

async function copy(sel) {
  var v = $(sel).value
  if (!v) return
  await outilo.clipboard.write(v)
  outilo.toast(outilo.t('copied'), 'success')
}

$('#file').addEventListener('change', function () {
  var f = this.files[0]
  this.value = ''
  if (!f) return
  if (f.size > 10 * 1024 * 1024) return status(outilo.t('tooBig'), true)
  f.arrayBuffer().then(function (buf) {
    $('#coded').value = EncLogic.bytesToBase64(new Uint8Array(buf))
    $('#plain').value = ''
    status(outilo.t('fileDone', { name: f.name, size: f.size.toLocaleString(outilo.locale) }))
  })
})

document.querySelectorAll('#codecs .o-chip').forEach(function (b) {
  b.addEventListener('click', function () { setCodec(b.dataset.codec) })
})
$('#plain').addEventListener('input', encode)
$('#coded').addEventListener('input', decode)
$('#all').addEventListener('change', encode)
$('#enc').addEventListener('click', encode)
$('#dec').addEventListener('click', decode)
$('#copyPlain').addEventListener('click', function () { copy('#plain') })
$('#copyCoded').addEventListener('click', function () { copy('#coded') })

outilo.ready.then(async function () {
  var saved = null
  try { saved = await outilo.storage.get('codec') } catch (e) { /* aucun stockage */ }
  setCodec(EncLogic.codecs.indexOf(saved) >= 0 ? saved : 'base64')
  $('#plain').focus()
})
