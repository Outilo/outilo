/* global outilo, MdLogic */
'use strict'

outilo.messages = {
  fr: {
    subtitle: 'Aperçu en direct, HTML propre à copier ou à enregistrer.', preview: 'Aperçu', copyHtml: 'Copier le HTML',
    saveHtml: 'Enregistrer en page HTML', saveMd: 'Enregistrer .md', copied: 'HTML copié', saved: 'Fichier enregistré',
    stats: '{words} mots · {headings} titres',
    sample: '# Bienvenue\n\nÉcrivez du **Markdown** à gauche : l’aperçu se met à jour.\n\n## Liste\n\n- [x] Titres, *italique*, `code`\n- [ ] Tableaux\n\n| Outil | Catégorie |\n|---|---|\n| JSON | Code |\n\n> Astuce : « Enregistrer en page HTML » produit un fichier imprimable.\n'
  },
  en: {
    subtitle: 'Live preview, clean HTML to copy or save.', preview: 'Preview', copyHtml: 'Copy HTML',
    saveHtml: 'Save as HTML page', saveMd: 'Save .md', copied: 'HTML copied', saved: 'File saved',
    stats: '{words} words · {headings} headings',
    sample: '# Welcome\n\nWrite **Markdown** on the left: the preview updates.\n\n## List\n\n- [x] Headings, *italics*, `code`\n- [ ] Tables\n\n| Tool | Category |\n|---|---|\n| JSON | Code |\n\n> Tip: “Save as HTML page” produces a printable file.\n'
  }
}

var $ = function (s) { return document.querySelector(s) }
var html = ''
var timer

function render() {
  var md = $('#md').value
  html = MdLogic.render(md)
  // Contenu déjà assaini par MdLogic.render
  $('#preview').innerHTML = html
  $('#html').textContent = html
  var words = md.split(/\s+/).filter(function (w) { return /[\p{L}\p{N}]/u.test(w) }).length
  $('#stats').textContent = outilo.t('stats', { words: words, headings: MdLogic.toc(md).length })
  clearTimeout(timer)
  timer = setTimeout(function () { outilo.storage.set('md', md.slice(0, 500000)).catch(function () {}) }, 500)
}

function title() {
  var first = MdLogic.toc($('#md').value)[0]
  return first ? first.text : 'document'
}

document.querySelectorAll('[data-view]').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('[data-view]').forEach(function (x) { x.classList.toggle('on', x === b) })
    $('#panes').classList.toggle('showHtml', b.dataset.view === 'html')
  })
})
$('#md').addEventListener('input', render)
$('#copyHtml').addEventListener('click', async function () {
  await outilo.clipboard.write(html)
  outilo.toast(outilo.t('copied'), 'success')
})
$('#saveHtml').addEventListener('click', async function () {
  if (await outilo.files.save(MdLogic.slug(title()) + '.html', MdLogic.documentHtml(html, title()))) outilo.toast(outilo.t('saved'), 'success')
})
$('#saveMd').addEventListener('click', async function () {
  if (await outilo.files.save(MdLogic.slug(title()) + '.md', $('#md').value)) outilo.toast(outilo.t('saved'), 'success')
})
// Les liens s'ouvriraient dans le cadre isolé : on les désactive dans l'aperçu
$('#preview').addEventListener('click', function (e) { if (e.target.closest('a')) e.preventDefault() })

outilo.ready.then(async function () {
  var saved = null
  try { saved = await outilo.storage.get('md') } catch (e) { /* aucun stockage */ }
  $('#md').value = saved || outilo.t('sample')
  render()
})
