/* global outilo, QrLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'QR code', subtitle: 'Lien, texte, Wi-Fi ou e-mail ; export PNG ou SVG.',
    kText: 'Texte / lien', kEmail: 'E-mail', ssid: 'Nom du réseau (SSID)', wpass: 'Mot de passe', open: 'Ouvert',
    hiddenNet: 'Réseau masqué', to: 'Destinataire', subject: 'Objet', body: 'Message', ecc: 'Correction', size: 'Taille',
    fg: 'Encre', bg: 'Fond', png: 'Enregistrer PNG', svg: 'Enregistrer SVG', copy: 'Copier le contenu encodé',
    copied: 'Copié', saved: 'QR code enregistré', tooLong: 'Contenu trop long pour un QR code', info: '{size} × {size} modules · {chars} caractères',
    lowContrast: 'Contraste faible : le code risque de ne pas être lu'
  },
  en: {
    title: 'QR code', subtitle: 'Link, text, Wi-Fi or email; PNG or SVG export.',
    kText: 'Text / link', kEmail: 'Email', ssid: 'Network name (SSID)', wpass: 'Password', open: 'Open',
    hiddenNet: 'Hidden network', to: 'Recipient', subject: 'Subject', body: 'Message', ecc: 'Error correction', size: 'Size',
    fg: 'Ink', bg: 'Background', png: 'Save PNG', svg: 'Save SVG', copy: 'Copy encoded content',
    copied: 'Copied', saved: 'QR code saved', tooLong: 'Content too long for a QR code', info: '{size} × {size} modules · {chars} characters',
    lowContrast: 'Low contrast: the code may not scan'
  }
}

var $ = function (s) { return document.querySelector(s) }
var kind = 'text'
var current = null

function content() {
  if (kind === 'wifi') return QrLogic.wifi({ ssid: $('#ssid').value, password: $('#wpass').value, security: $('#security').value, hidden: $('#hidden').checked })
  if (kind === 'email') return QrLogic.email({ to: $('#to').value.trim(), subject: $('#subject').value, body: $('#body').value })
  return $('#text').value
}

function lum(hex) {
  var n = parseInt(hex.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

function render() {
  var text = content()
  var status = $('#status')
  $('#code').innerHTML = ''
  current = null
  if (!text) return (status.textContent = '')
  try {
    var m = QrLogic.matrix(text, $('#ecc').value)
    current = { text: text, m: m }
    $('#code').innerHTML = QrLogic.svg(m, { px: 260, fg: $('#fg').value, bg: $('#bg').value, margin: 4 })
    var low = Math.abs(lum($('#fg').value) - lum($('#bg').value)) < 0.4
    status.className = 'o-sub' + (low ? ' o-err' : '')
    status.textContent = low ? outilo.t('lowContrast') : outilo.t('info', { size: m.size, chars: text.length })
  } catch (e) {
    status.className = 'o-sub o-err'
    status.textContent = outilo.t('tooLong')
  }
}

function svgText() {
  return QrLogic.svg(current.m, { px: +$('#px').value, fg: $('#fg').value, bg: $('#bg').value, margin: 4 })
}

async function savePng() {
  if (!current) return
  var px = +$('#px').value
  var img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText())
  await img.decode()
  var canvas = document.createElement('canvas')
  canvas.width = canvas.height = px
  var ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0, px, px)
  var b64 = canvas.toDataURL('image/png').split(',')[1]
  if (await outilo.files.save('qrcode.png', b64, { encoding: 'base64' })) outilo.toast(outilo.t('saved'), 'success')
}

async function saveSvg() {
  if (!current) return
  if (await outilo.files.save('qrcode.svg', svgText())) outilo.toast(outilo.t('saved'), 'success')
}

document.querySelectorAll('#kinds .o-chip').forEach(function (b) {
  b.addEventListener('click', function () {
    kind = b.dataset.kind
    document.querySelectorAll('#kinds .o-chip').forEach(function (x) { x.classList.toggle('on', x === b) })
    document.querySelectorAll('[data-form]').forEach(function (f) { f.classList.toggle('hidden', f.dataset.form !== kind) })
    render()
  })
})
document.querySelectorAll('input, textarea, select').forEach(function (el) { el.addEventListener('input', render) })
$('#png').addEventListener('click', savePng)
$('#svg').addEventListener('click', saveSvg)
$('#copy').addEventListener('click', async function () {
  if (!current) return
  await outilo.clipboard.write(current.text)
  outilo.toast(outilo.t('copied'), 'success')
})

outilo.onLocale(render)
outilo.ready.then(function () { render(); $('#text').focus() })
