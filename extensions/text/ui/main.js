/* global outilo, TextLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Texte', subtitle: 'Changer la casse, nettoyer, trier, compter, rechercher et remplacer.',
    placeholder: 'Collez votre texte ici…', find: 'Rechercher', by: 'Remplacer par', caseSensitive: 'Respecter la casse',
    replace: 'Remplacer tout', undo: 'Annuler', copy: 'Copier', copied: 'Copié', badRegex: 'Expression régulière invalide',
    upper: 'MAJUSCULES', lower: 'minuscules', title: 'Titre', sentence: 'Phrase', camel: 'camelCase', pascal: 'PascalCase',
    snake: 'snake_case', kebab: 'kebab-case', constant: 'CONSTANTE', slug: 'slug', noAccents: 'Sans accents', invert: 'iNVERSER',
    trim: 'Rogner les lignes', sort: 'Trier A→Z', sortDesc: 'Trier Z→A', unique: 'Dédoublonner', reverse: 'Inverser l’ordre',
    removeEmpty: 'Supprimer les lignes vides', shuffle: 'Mélanger', number: 'Numéroter',
    chars: 'caractères', charsNoSpaces: 'sans espaces', words: 'mots', lines: 'lignes', sentences: 'phrases',
    paragraphs: 'paragraphes', readingMinutes: 'min de lecture', bytes: 'octets (UTF-8)'
  },
  en: {
    title: 'Text', subtitle: 'Change case, clean up, sort, count, find and replace.',
    placeholder: 'Paste your text here…', find: 'Find', by: 'Replace with', caseSensitive: 'Match case',
    replace: 'Replace all', undo: 'Undo', copy: 'Copy', copied: 'Copied', badRegex: 'Invalid regular expression',
    upper: 'UPPERCASE', lower: 'lowercase', title: 'Title Case', sentence: 'Sentence', camel: 'camelCase', pascal: 'PascalCase',
    snake: 'snake_case', kebab: 'kebab-case', constant: 'CONSTANT', slug: 'slug', noAccents: 'No accents', invert: 'iNVERT',
    trim: 'Trim lines', sort: 'Sort A→Z', sortDesc: 'Sort Z→A', unique: 'Remove duplicates', reverse: 'Reverse order',
    removeEmpty: 'Remove empty lines', shuffle: 'Shuffle', number: 'Number lines',
    chars: 'characters', charsNoSpaces: 'without spaces', words: 'words', lines: 'lines', sentences: 'sentences',
    paragraphs: 'paragraphs', readingMinutes: 'min read', bytes: 'bytes (UTF-8)'
  }
}

var $ = function (s) { return document.querySelector(s) }
var undoStack = []
var saveTimer

function setText(v) {
  undoStack.push($('#text').value)
  if (undoStack.length > 50) undoStack.shift()
  $('#text').value = v
  update()
}

function update() {
  var s = TextLogic.stats($('#text').value)
  var box = $('#stats')
  box.innerHTML = ''
  Object.keys(s).forEach(function (k) {
    var d = document.createElement('div')
    var strong = document.createElement('strong'); strong.textContent = s[k].toLocaleString(outilo.locale)
    var span = document.createElement('span'); span.textContent = outilo.t(k)
    d.append(strong, span)
    box.appendChild(d)
  })
  clearTimeout(saveTimer)
  saveTimer = setTimeout(function () { outilo.storage.set('text', $('#text').value.slice(0, 200000)).catch(function () {}) }, 600)
}

function buttons() {
  ;[['#cases', TextLogic.CASES], ['#lines', TextLogic.LINES]].forEach(function (g) {
    var box = $(g[0])
    box.innerHTML = ''
    g[1].forEach(function (op) {
      var b = document.createElement('button')
      b.className = 'o-chip'
      b.textContent = outilo.t(op)
      b.addEventListener('click', function () { setText(TextLogic.transform($('#text').value, op)) })
      box.appendChild(b)
    })
  })
}

$('#text').addEventListener('input', update)
$('#replace').addEventListener('click', function () {
  try {
    setText(TextLogic.replaceAll($('#text').value, $('#find').value, $('#by').value, { regex: $('#regex').checked, caseSensitive: $('#case').checked }))
  } catch (e) {
    outilo.toast(outilo.t('badRegex'), 'error')
  }
})
$('#undo').addEventListener('click', function () { if (undoStack.length) { $('#text').value = undoStack.pop(); update() } })
$('#copy').addEventListener('click', async function () {
  await outilo.clipboard.write($('#text').value)
  outilo.toast(outilo.t('copied'), 'success')
})

outilo.onLocale(function () { buttons(); update() })
outilo.ready.then(async function () {
  try { $('#text').value = (await outilo.storage.get('text')) || '' } catch (e) { /* aucun stockage */ }
  buttons()
  update()
  $('#text').focus()
})
