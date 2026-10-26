/* global outilo, ImageLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Images', subtitle: 'Convertir en PNG, JPEG ou WebP, redimensionner, faire pivoter. Tout reste sur votre PC.',
    drop: 'Déposez une image ici ou cliquez pour la choisir', format: 'Format', quality: 'Qualité', width: 'Largeur',
    height: 'Hauteur', auto: 'auto', keep: 'Garder les proportions', rotate: 'Pivoter 90°', flip: 'Miroir',
    copyUrl: 'Copier en data URL', save: 'Enregistrer', saved: 'Image enregistrée', copied: 'Data URL copiée',
    info: '{w} × {h} px · {size}', gain: '{w} × {h} px · {size} ({pct} %)', bad: 'Image illisible', tooBig: 'Image trop grande (100 Mo maximum)'
  },
  en: {
    title: 'Images', subtitle: 'Convert to PNG, JPEG or WebP, resize, rotate. Everything stays on your PC.',
    drop: 'Drop an image here or click to choose one', format: 'Format', quality: 'Quality', width: 'Width',
    height: 'Height', auto: 'auto', keep: 'Keep proportions', rotate: 'Rotate 90°', flip: 'Mirror',
    copyUrl: 'Copy as data URL', save: 'Save', saved: 'Image saved', copied: 'Data URL copied',
    info: '{w} × {h} px · {size}', gain: '{w} × {h} px · {size} ({pct}%)', bad: 'Unreadable image', tooBig: 'Image too large (100 MB max)'
  }
}

var $ = function (s) { return document.querySelector(s) }
var source = null // { img, name, size }
var rotate = 0
var flip = false
var output = null // { dataUrl, b64 }
var timer

function opts() {
  return { width: $('#width').value, height: $('#height').value, keep: $('#keep').checked, rotate: rotate }
}

function convert() {
  if (!source) return
  var img = source.img
  var t = ImageLogic.targetSize(img.naturalWidth, img.naturalHeight, opts())
  var canvas = document.createElement('canvas')
  canvas.width = t.width
  canvas.height = t.height
  var ctx = canvas.getContext('2d')
  var fmt = ImageLogic.FORMATS[$('#format').value]
  if (!fmt.lossy) ctx.clearRect(0, 0, t.width, t.height)
  else { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, t.width, t.height) } // JPEG : pas de transparence
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(t.width / 2, t.height / 2)
  ctx.rotate((rotate * Math.PI) / 180)
  if (flip) ctx.scale(-1, 1)
  var sideways = rotate === 90 || rotate === 270
  var dw = sideways ? t.height : t.width
  var dh = sideways ? t.width : t.height
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
  var dataUrl = canvas.toDataURL(fmt.mime, +$('#quality').value)
  output = { dataUrl: dataUrl, b64: dataUrl.split(',')[1] }
  $('#after').src = dataUrl
  var size = ImageLogic.base64Size(output.b64)
  $('#afterInfo').textContent = outilo.t('gain', { w: t.width, h: t.height, size: ImageLogic.bytes(size, outilo.locale), pct: Math.round((size / source.size) * 100) })
}

function schedule() { clearTimeout(timer); timer = setTimeout(convert, 150) }

function load(file) {
  if (!file) return
  if (file.size > 100 * 1024 * 1024) return outilo.toast(outilo.t('tooBig'), 'error')
  var url = URL.createObjectURL(file)
  var img = new Image()
  img.onload = function () {
    source = { img: img, name: file.name, size: file.size }
    rotate = 0
    flip = false
    $('#before').src = url
    $('#beforeInfo').textContent = outilo.t('info', { w: img.naturalWidth, h: img.naturalHeight, size: ImageLogic.bytes(file.size, outilo.locale) })
    $('#dropText').textContent = file.name
    $('#view').classList.remove('hidden')
    convert()
  }
  img.onerror = function () { outilo.toast(outilo.t('bad'), 'error') }
  img.src = url
}

$('#file').addEventListener('change', function () { load(this.files[0]); this.value = '' })
var drop = $('#drop')
drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over') })
drop.addEventListener('dragleave', function () { drop.classList.remove('over') })
drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); load(e.dataTransfer.files[0]) })
;['#format', '#width', '#height', '#keep'].forEach(function (s) { $(s).addEventListener('input', schedule) })
$('#format').addEventListener('change', function () { $('#qualityOpt').classList.toggle('hidden', !ImageLogic.FORMATS[this.value].lossy) })
$('#quality').addEventListener('input', function () { $('#qv').textContent = Math.round(this.value * 100) + ' %'; schedule() })
$('#rotate').addEventListener('click', function () { rotate = (rotate + 90) % 360; convert() })
$('#flip').addEventListener('click', function () { flip = !flip; convert() })
$('#save').addEventListener('click', async function () {
  if (!output) return
  if (await outilo.files.save(ImageLogic.outName(source.name, $('#format').value), output.b64, { encoding: 'base64' })) outilo.toast(outilo.t('saved'), 'success')
})
$('#copyUrl').addEventListener('click', async function () {
  if (!output) return
  await outilo.clipboard.write(output.dataUrl)
  outilo.toast(outilo.t('copied'), 'success')
})

outilo.ready.then(function () {})
