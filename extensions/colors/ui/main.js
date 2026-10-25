/* global outilo, ColorLogic, EyeDropper */
'use strict'

outilo.messages = {
  fr: {
    title: 'Couleurs', subtitle: 'Conversions HEX, RGB, HSL, OKLCH, contraste WCAG et palettes.',
    pick: 'Pipette', contrast: 'Contraste', against: 'Avec', asText: 'La couleur est celle du texte',
    sampleBig: 'Titre d’exemple', sampleSmall: 'Texte courant pour juger de la lisibilité.',
    shades: 'Nuances', complementary: 'Complémentaire', analogous: 'Analogues', triadic: 'Triadique',
    copyCss: 'Copier en variables CSS', copy: 'Copier', copied: '{v} copié', invalid: 'Couleur non reconnue',
    aa: 'AA texte', aaLarge: 'AA grand texte', aaa: 'AAA texte', aaaLarge: 'AAA grand texte'
  },
  en: {
    title: 'Colors', subtitle: 'HEX, RGB, HSL, OKLCH conversions, WCAG contrast and palettes.',
    pick: 'Eyedropper', contrast: 'Contrast', against: 'Against', asText: 'The color is the text color',
    sampleBig: 'Sample heading', sampleSmall: 'Body text to judge readability.',
    shades: 'Shades', complementary: 'Complementary', analogous: 'Analogous', triadic: 'Triadic',
    copyCss: 'Copy as CSS variables', copy: 'Copy', copied: '{v} copied', invalid: 'Unrecognized color',
    aa: 'AA text', aaLarge: 'AA large text', aaa: 'AAA text', aaaLarge: 'AAA large text'
  }
}

var $ = function (s) { return document.querySelector(s) }
var kind = 'shades'
var current = null
var saveTimer

async function copy(v) {
  await outilo.clipboard.write(v)
  outilo.toast(outilo.t('copied', { v: v }), 'success')
}

function render() {
  var c = ColorLogic.parse($('#input').value)
  $('#input').style.borderColor = c ? '' : 'var(--o-danger)'
  if (!c) return
  current = c
  var hex = ColorLogic.toHex({ r: c.r, g: c.g, b: c.b, a: 1 })
  var sw = $('#swatch')
  sw.style.background = ColorLogic.toHex(c)
  sw.style.color = ColorLogic.ink(c)
  $('#swatchText').textContent = ColorLogic.toHex(c)
  $('#native').value = hex

  var tbody = $('#formats')
  tbody.innerHTML = ''
  ColorLogic.formats(c).forEach(function (f) {
    var tr = document.createElement('tr')
    var k = document.createElement('td'); k.className = 'k'; k.textContent = f.id.toUpperCase()
    var v = document.createElement('td'); v.className = 'v'; v.textContent = f.value
    var b = document.createElement('td')
    var btn = document.createElement('button'); btn.className = 'o-btn o-btn--sm'; btn.textContent = outilo.t('copy')
    btn.addEventListener('click', function () { copy(f.value) })
    b.appendChild(btn)
    tr.append(k, v, b)
    tbody.appendChild(tr)
  })

  var other = ColorLogic.parse($('#other').value) || { r: 255, g: 255, b: 255, a: 1 }
  var asText = $('#asText').checked
  var pv = $('#preview')
  pv.style.background = ColorLogic.toHex(asText ? other : c)
  pv.style.color = ColorLogic.toHex(asText ? c : other)
  var ratio = ColorLogic.contrast(c, other)
  $('#ratio').textContent = (Math.floor(ratio * 100) / 100).toFixed(2) + ' : 1'
  var w = ColorLogic.wcag(ratio)
  var badges = $('#badges')
  badges.innerHTML = ''
  ;['aa', 'aaLarge', 'aaa', 'aaaLarge'].forEach(function (k) {
    var s = document.createElement('span')
    s.className = 'o-badge ' + (w[k] ? 'o-ok' : 'o-err')
    s.textContent = (w[k] ? '✓ ' : '✗ ') + outilo.t(k)
    badges.appendChild(s)
  })

  var pal = $('#palette')
  pal.innerHTML = ''
  ColorLogic.palette(c, kind).forEach(function (h) {
    var b = document.createElement('button')
    b.style.background = h
    b.style.color = ColorLogic.ink(ColorLogic.parse(h))
    b.textContent = h
    b.title = outilo.t('copy') + ' ' + h
    b.addEventListener('click', function () { copy(h) })
    pal.appendChild(b)
  })

  clearTimeout(saveTimer)
  saveTimer = setTimeout(function () { outilo.storage.set('state', { input: $('#input').value, other: $('#other').value }).catch(function () {}) }, 400)
}

document.querySelectorAll('#kinds .o-chip').forEach(function (b) {
  b.addEventListener('click', function () {
    kind = b.dataset.kind
    document.querySelectorAll('#kinds .o-chip').forEach(function (x) { x.classList.toggle('on', x === b) })
    render()
  })
})
$('#input').addEventListener('input', render)
$('#other').addEventListener('input', render)
$('#asText').addEventListener('change', render)
$('#native').addEventListener('input', function () { $('#input').value = this.value; render() })
$('#copyCss').addEventListener('click', function () {
  if (!current) return
  var css = ColorLogic.palette(current, kind).map(function (h, i) { return '  --couleur-' + (kind === 'shades' ? (i ? i * 100 : 50) : i + 1) + ': ' + h + ';' }).join('\n')
  copy(':root {\n' + css + '\n}')
})

// Pipette d'écran (Chromium / WebView2), si le moteur l'autorise dans le cadre isolé
if (typeof EyeDropper === 'function') {
  $('#pick').classList.remove('hidden')
  $('#pick').addEventListener('click', function () {
    new EyeDropper().open().then(function (r) { $('#input').value = r.sRGBHex; render() }).catch(function () {})
  })
}

outilo.onLocale(render)
outilo.ready.then(async function () {
  try {
    var s = await outilo.storage.get('state')
    if (s) { $('#input').value = s.input || '#f59e0b'; $('#other').value = s.other || '#ffffff' }
  } catch (e) { /* aucun stockage */ }
  render()
})
