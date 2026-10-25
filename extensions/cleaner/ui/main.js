/* global outilo, CleanLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Nettoyeur', subtitle: 'Libère de l’espace dans votre profil : fichiers temporaires, caches des navigateurs et des outils de développement.',
    selected: 'Sélectionné', scan: 'Analyser', clean: 'Nettoyer', scanning: 'Analyse en cours…', cleaning: 'Nettoyage…',
    system: 'Windows', browser: 'Navigateurs', dev: 'Développement', files: '{n} fichier(s)',
    done: '{size} libérés ({files} fichiers)', skipped: ' · {n} fichier(s) en cours d’utilisation ignoré(s)', cancelled: 'Nettoyage annulé',
    note: 'Sans droits administrateur : seuls les dossiers de votre profil sont concernés. Les fichiers ouverts par un programme sont ignorés. Une confirmation Windows est toujours demandée.',
    empty: 'Rien à nettoyer'
  },
  en: {
    title: 'Cleaner', subtitle: 'Free up space in your profile: temporary files, browser and developer tool caches.',
    selected: 'Selected', scan: 'Scan', clean: 'Clean', scanning: 'Scanning…', cleaning: 'Cleaning…',
    system: 'Windows', browser: 'Browsers', dev: 'Development', files: '{n} file(s)',
    done: '{size} freed ({files} files)', skipped: ' · {n} file(s) in use skipped', cancelled: 'Cleanup cancelled',
    note: 'No administrator rights: only folders in your profile are affected. Files opened by a program are skipped. Windows always asks for confirmation.',
    empty: 'Nothing to clean'
  }
}

var $ = function (s) { return document.querySelector(s) }
var targets = []
var selected = []
var busy = false

function updateTotal() {
  var t = CleanLogic.total(targets, selected)
  $('#total').textContent = targets.length ? CleanLogic.bytes(t.bytes, outilo.locale) : '—'
  $('#clean').disabled = busy || !t.bytes
}

function render() {
  var box = $('#groups')
  box.innerHTML = ''
  CleanLogic.grouped(targets).forEach(function (g) {
    var wrap = document.createElement('div')
    wrap.className = 'group'
    var label = document.createElement('span'); label.className = 'o-label'; label.textContent = outilo.t(g.id)
    var panel = document.createElement('div'); panel.className = 'o-panel o-panel--flush'
    g.items.forEach(function (t) {
      var row = document.createElement('label'); row.className = 'item'
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = selected.indexOf(t.id) >= 0; cb.disabled = !t.bytes
      cb.addEventListener('change', function () {
        selected = cb.checked ? selected.concat(t.id) : selected.filter(function (x) { return x !== t.id })
        updateTotal()
      })
      var name = document.createElement('span'); name.className = 'name'; name.textContent = t.label
      var size = document.createElement('span'); size.className = 'size'
      size.textContent = CleanLogic.bytes(t.bytes, outilo.locale) + ' · ' + outilo.t('files', { n: t.files.toLocaleString(outilo.locale) })
      row.append(cb, name, size)
      panel.appendChild(row)
    })
    wrap.append(label, panel)
    box.appendChild(wrap)
  })
  updateTotal()
}

async function scan(keepSelection) {
  busy = true
  $('#scan').disabled = true
  $('#status').className = 'o-sub'
  $('#status').textContent = outilo.t('scanning')
  try {
    targets = await outilo.clean.scan()
    selected = keepSelection ? selected.filter(function (id) { return targets.some(function (t) { return t.id === id && t.bytes }) }) : CleanLogic.defaults(targets)
    if (!keepSelection) $('#status').textContent = targets.some(function (t) { return t.bytes }) ? '' : outilo.t('empty')
  } catch (e) {
    $('#status').textContent = e.message
    $('#status').className = 'o-sub o-err'
  } finally {
    busy = false
    $('#scan').disabled = false
    render()
  }
}

$('#scan').addEventListener('click', function () { scan(false) })
$('#clean').addEventListener('click', async function () {
  busy = true
  updateTotal()
  $('#status').className = 'o-sub'
  $('#status').textContent = outilo.t('cleaning')
  try {
    var r = await outilo.clean.run(selected)
    if (!r) {
      $('#status').textContent = outilo.t('cancelled')
    } else {
      var msg = outilo.t('done', { size: CleanLogic.bytes(r.bytes, outilo.locale), files: r.files.toLocaleString(outilo.locale) }) + (r.skipped ? outilo.t('skipped', { n: r.skipped }) : '')
      $('#status').textContent = msg
      $('#status').className = 'o-sub o-ok'
      outilo.toast(msg, 'success')
    }
  } catch (e) {
    $('#status').textContent = e.message
    $('#status').className = 'o-sub o-err'
  }
  busy = false
  await scan(true)
})

outilo.onLocale(render)
outilo.ready.then(function () { scan(false) })
