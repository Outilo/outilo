/* global outilo, CronLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Cron', subtitle: 'Expression cron ⇄ description lisible, et prochaines exécutions.',
    copy: 'Copier', copied: 'Copié', next: 'Prochaines exécutions', in: 'Dans',
    minute: 'minute', hour: 'heure', dom: 'jour du mois', month: 'mois', dow: 'jour de semaine',
    errFields: 'Une expression cron a 5 champs : minute heure jour-du-mois mois jour-de-semaine',
    errField: 'Champ « {field} » invalide : {token}', none: 'Aucune exécution dans les prochaines années',
    p1: 'Toutes les 5 min', p2: 'Chaque heure', p3: 'Tous les jours à minuit', p4: 'Jours ouvrés 9 h', p5: 'Chaque lundi', p6: 'Le 1er du mois'
  },
  en: {
    title: 'Cron', subtitle: 'Cron expression ⇄ readable description, and next runs.',
    copy: 'Copy', copied: 'Copied', next: 'Next runs', in: 'In',
    minute: 'minute', hour: 'hour', dom: 'day of month', month: 'month', dow: 'day of week',
    errFields: 'A cron expression has 5 fields: minute hour day-of-month month day-of-week',
    errField: 'Invalid “{field}” field: {token}', none: 'No run in the coming years',
    p1: 'Every 5 min', p2: 'Hourly', p3: 'Daily at midnight', p4: 'Weekdays 9 am', p5: 'Every Monday', p6: '1st of the month'
  }
}

var $ = function (s) { return document.querySelector(s) }
var PRESETS = [['p1', '*/5 * * * *'], ['p2', '0 * * * *'], ['p3', '0 0 * * *'], ['p4', '0 9 * * 1-5'], ['p5', '0 8 * * MON'], ['p6', '0 6 1 * *']]

function render() {
  var expr = $('#expr').value
  var p = CronLogic.parse(expr)
  var desc = $('#desc')
  var fields = $('#fields')
  var runs = $('#runs')
  fields.innerHTML = ''
  runs.innerHTML = ''
  if (!p.ok) {
    desc.className = 'desc o-err'
    desc.textContent = p.error === 'fields' ? outilo.t('errFields') : outilo.t('errField', { field: outilo.t(p.field), token: p.token })
    return
  }
  desc.className = 'desc'
  desc.textContent = CronLogic.describe(p, outilo.locale)
  CronLogic.FIELDS.forEach(function (f) {
    var d = document.createElement('div')
    var c = document.createElement('code'); c.textContent = p[f.id].raw
    var s = document.createElement('small'); s.textContent = outilo.t(f.id)
    d.append(c, s)
    fields.appendChild(d)
  })
  var now = Date.now()
  var list = CronLogic.next(p, now, 10)
  if (!list.length) {
    var tr = document.createElement('tr'); var td = document.createElement('td'); td.textContent = outilo.t('none'); tr.appendChild(td); runs.appendChild(tr)
  }
  var rtf = new Intl.RelativeTimeFormat(outilo.locale, { numeric: 'auto' })
  list.forEach(function (d) {
    var tr = document.createElement('tr')
    var a = document.createElement('td'); a.textContent = new Intl.DateTimeFormat(outilo.locale, { dateStyle: 'full', timeStyle: 'short' }).format(d)
    var b = document.createElement('td')
    var min = Math.round((d - now) / 60000)
    b.textContent = min < 60 ? rtf.format(min, 'minute') : min < 2880 ? rtf.format(Math.round(min / 60), 'hour') : rtf.format(Math.round(min / 1440), 'day')
    tr.append(a, b)
    runs.appendChild(tr)
  })
}

function presets() {
  var box = $('#presets')
  box.innerHTML = ''
  PRESETS.forEach(function (pr) {
    var b = document.createElement('button')
    b.className = 'o-chip'
    b.textContent = outilo.t(pr[0])
    b.title = pr[1]
    b.addEventListener('click', function () { $('#expr').value = pr[1]; save(); render() })
    box.appendChild(b)
  })
}

function save() { outilo.storage.set('expr', $('#expr').value).catch(function () {}) }

$('#expr').addEventListener('input', function () { render(); save() })
$('#copy').addEventListener('click', async function () {
  await outilo.clipboard.write($('#expr').value.trim())
  outilo.toast(outilo.t('copied'), 'success')
})

outilo.onLocale(function () { presets(); render() })
outilo.ready.then(async function () {
  try {
    var saved = await outilo.storage.get('expr')
    if (saved) $('#expr').value = saved
  } catch (e) { /* aucun stockage */ }
  presets()
  render()
  setInterval(render, 60000)
  $('#expr').focus()
})
