/* global outilo, PasswordLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Mots de passe', subtitle: 'Aléa cryptographique : rien ne quitte votre machine.',
    copy: 'Copier', copyAll: 'Tout copier', generate: 'Générer', mode: 'Type', password: 'Mot de passe',
    passphrase: 'Phrase de passe', length: 'Longueur', chars: 'Caractères', words: 'Mots', separator: 'Séparateur',
    capitalize: 'Majuscules', number: 'Nombre', batch: 'Génération en lot',
    similar: 'Exclure les caractères similaires (0 O 1 l I)',
    ambiguous: 'Exclure les caractères ambigus ({ } [ ] ( ) / \\ \' " ` ~ , ; : . < >)',
    bits: '{n} bits d’entropie', copied: 'Copié dans le presse-papiers',
    l0: 'Faible', l1: 'Correct', l2: 'Fort', l3: 'Très fort'
  },
  en: {
    title: 'Passwords', subtitle: 'Cryptographic randomness: nothing leaves your machine.',
    copy: 'Copy', copyAll: 'Copy all', generate: 'Generate', mode: 'Type', password: 'Password',
    passphrase: 'Passphrase', length: 'Length', chars: 'Characters', words: 'Words', separator: 'Separator',
    capitalize: 'Capitalize', number: 'Number', batch: 'Batch generation',
    similar: 'Exclude similar characters (0 O 1 l I)',
    ambiguous: 'Exclude ambiguous characters ({ } [ ] ( ) / \\ \' " ` ~ , ; : . < >)',
    bits: '{n} bits of entropy', copied: 'Copied to clipboard',
    l0: 'Weak', l1: 'Fair', l2: 'Strong', l3: 'Very strong'
  }
}

var $ = function (s) { return document.querySelector(s) }
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)) }

var opts = {
  mode: 'password', length: 20, upper: true, lower: true, digits: true, symbols: true,
  excludeSimilar: false, excludeAmbiguous: false, words: 5, separator: '-', capitalize: true, number: true
}
var last = { value: '', bits: 0 }

function generateOne() {
  return opts.mode === 'passphrase'
    ? PasswordLogic.passphrase({ words: opts.words, separator: opts.separator, capitalize: opts.capitalize, number: opts.number, lang: outilo.locale })
    : PasswordLogic.password(opts)
}

function render() {
  $('#out').textContent = last.value
  var level = PasswordLogic.strength(last.bits)
  $('#meter').style.width = Math.min(100, last.bits / 1.28) + '%'
  $('#bits').textContent = outilo.t('bits', { n: last.bits })
  $('#level').textContent = outilo.t('l' + level)
}

function generate() {
  last = generateOne()
  render()
  save()
}

function syncControls() {
  $$('#modes .o-chip').forEach(function (c) { c.classList.toggle('on', c.dataset.mode === opts.mode) })
  $('#pwOpts').classList.toggle('hidden', opts.mode !== 'password')
  $('#ppOpts').classList.toggle('hidden', opts.mode !== 'passphrase')
  $('#len').value = opts.length
  $('#lenv').textContent = opts.length
  $$('#sets .o-chip').forEach(function (c) { c.classList.toggle('on', !!opts[c.dataset.k]) })
  $('#similar').checked = opts.excludeSimilar
  $('#ambiguous').checked = opts.excludeAmbiguous
  $('#words').value = opts.words
  $('#wordsv').textContent = opts.words
  $('#sep').value = opts.separator
  $('#cap').checked = opts.capitalize
  $('#num').checked = opts.number
}

// Seules les options sont mémorisées, jamais les mots de passe
function save() { outilo.storage.set('options', opts).catch(function () {}) }

async function copy(text) {
  await outilo.clipboard.write(text)
  outilo.toast(outilo.t('copied'), 'success')
}

$$('#modes .o-chip').forEach(function (c) {
  c.addEventListener('click', function () { opts.mode = c.dataset.mode; syncControls(); generate() })
})
$$('#sets .o-chip').forEach(function (c) {
  c.addEventListener('click', function () {
    var k = c.dataset.k
    opts[k] = !opts[k]
    if (!opts.upper && !opts.lower && !opts.digits && !opts.symbols) opts[k] = true
    syncControls()
    generate()
  })
})
$('#len').addEventListener('input', function (e) { opts.length = +e.target.value; $('#lenv').textContent = opts.length; generate() })
$('#words').addEventListener('input', function (e) { opts.words = +e.target.value; $('#wordsv').textContent = opts.words; generate() })
$('#similar').addEventListener('change', function (e) { opts.excludeSimilar = e.target.checked; generate() })
$('#ambiguous').addEventListener('change', function (e) { opts.excludeAmbiguous = e.target.checked; generate() })
$('#sep').addEventListener('change', function (e) { opts.separator = e.target.value; generate() })
$('#cap').addEventListener('change', function (e) { opts.capitalize = e.target.checked; generate() })
$('#num').addEventListener('change', function (e) { opts.number = e.target.checked; generate() })
$('#gen').addEventListener('click', generate)
$('#copy').addEventListener('click', function () { copy(last.value) })
$('#batchGen').addEventListener('click', function () {
  var n = +$('#count').value
  var lines = []
  for (var i = 0; i < n; i++) lines.push(generateOne().value)
  $('#batch').textContent = lines.join('\n')
})
$('#batchCopy').addEventListener('click', function () { if ($('#batch').textContent) copy($('#batch').textContent) })

outilo.onLocale(render)
outilo.onCommand(function (cmd) {
  if (cmd === 'copy-24') {
    opts.mode = 'password'
    opts.length = 24
    syncControls()
    generate()
    copy(last.value)
  } else if (cmd === 'passphrase') {
    opts.mode = 'passphrase'
    syncControls()
    generate()
  }
})

outilo.ready.then(async function () {
  try {
    var saved = await outilo.storage.get('options')
    if (saved && typeof saved === 'object') Object.assign(opts, saved)
  } catch (e) { /* première utilisation */ }
  syncControls()
  generate()
})
