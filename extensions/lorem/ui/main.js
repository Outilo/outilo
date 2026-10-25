/* global outilo, LoremLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Lorem ipsum', subtitle: 'Texte de remplissage pour vos maquettes : paragraphes, phrases, mots ou listes.',
    paragraphs: 'Paragraphes', sentences: 'Phrases', words: 'Mots', list: 'Liste', count: 'Nombre', lang: 'Langue',
    fr: 'Français', en: 'Anglais', format: 'Format', text: 'Texte', classic: 'Commencer par « Lorem ipsum… »',
    generate: 'Générer', copy: 'Copier', copied: 'Copié', stats: '{words} mots · {chars} caractères'
  },
  en: {
    title: 'Lorem ipsum', subtitle: 'Placeholder text for your mockups: paragraphs, sentences, words or lists.',
    paragraphs: 'Paragraphs', sentences: 'Sentences', words: 'Words', list: 'List', count: 'Count', lang: 'Language',
    fr: 'French', en: 'English', format: 'Format', text: 'Text', classic: 'Start with “Lorem ipsum…”',
    generate: 'Generate', copy: 'Copy', copied: 'Copied', stats: '{words} words · {chars} characters'
  }
}

var $ = function (s) { return document.querySelector(s) }
var unit = 'paragraphs'
var DEFAULTS = { paragraphs: 3, sentences: 5, words: 50, list: 6 }

function generate() {
  var blocks = LoremLogic.make({ unit: unit, count: +$('#count').value, lang: $('#lang').value, classic: $('#classic').checked })
  var text = LoremLogic.render(blocks, unit, $('#format').value)
  $('#out').textContent = text
  $('#stats').textContent = outilo.t('stats', LoremLogic.stats(text))
}

function setUnit(u) {
  unit = u
  document.querySelectorAll('#units .o-chip').forEach(function (c) { c.classList.toggle('on', c.dataset.unit === u) })
  $('#count').value = DEFAULTS[u]
  generate()
}

document.querySelectorAll('#units .o-chip').forEach(function (c) { c.addEventListener('click', function () { setUnit(c.dataset.unit) }) })
;['#count', '#lang', '#format', '#classic'].forEach(function (s) { $(s).addEventListener('change', generate) })
$('#gen').addEventListener('click', generate)
$('#copy').addEventListener('click', async function () {
  await outilo.clipboard.write($('#out').textContent)
  outilo.toast(outilo.t('copied'), 'success')
})

outilo.onLocale(generate)
outilo.onCommand(function (cmd) {
  if (cmd === 'copy-paragraph') {
    var text = LoremLogic.render(LoremLogic.make({ unit: 'paragraphs', count: 1, lang: 'latin', classic: true }), 'paragraphs', 'text')
    outilo.clipboard.write(text).then(function () { outilo.toast(outilo.t('copied'), 'success') })
  }
})
outilo.ready.then(function () { setUnit('paragraphs') })
