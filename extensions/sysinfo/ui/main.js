/* global outilo, SysLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Infos système', subtitle: 'Système, processeur, mémoire, disques et cartes graphiques.',
    refresh: 'Actualiser', save: 'Enregistrer', copy: 'Copier le résumé', copied: 'Résumé copié', saved: 'Fichier enregistré',
    disk: 'Disque', fs: 'Système de fichiers', used: 'Utilisé', free: 'Libre', loading: 'Lecture…',
    os: 'Système', host: 'Nom du PC', cpu: 'Processeur', threads: 'threads', memory: 'Mémoire', gpu: 'Carte graphique',
    uptime: 'Allumé depuis', arch: 'Architecture', kernel: 'Noyau', swap: 'Mémoire virtuelle', cpuUsage: 'Charge processeur',
    removable: 'amovible', updated: 'Mis à jour à {time}', none: 'non détectée'
  },
  en: {
    title: 'System info', subtitle: 'System, processor, memory, disks and graphics cards.',
    refresh: 'Refresh', save: 'Save', copy: 'Copy summary', copied: 'Summary copied', saved: 'File saved',
    disk: 'Disk', fs: 'File system', used: 'Used', free: 'Free', loading: 'Reading…',
    os: 'System', host: 'PC name', cpu: 'Processor', threads: 'threads', memory: 'Memory', gpu: 'Graphics card',
    uptime: 'Up for', arch: 'Architecture', kernel: 'Kernel', swap: 'Virtual memory', cpuUsage: 'CPU load',
    removable: 'removable', updated: 'Updated at {time}', none: 'not detected'
  }
}

var $ = function (s) { return document.querySelector(s) }
var info = null

function labels() {
  var l = {}
  ;['os', 'host', 'cpu', 'threads', 'memory', 'gpu', 'disk', 'uptime', 'arch', 'kernel'].forEach(function (k) { l[k] = outilo.t(k) })
  return l
}

function card(label, value, sub, pct) {
  var d = document.createElement('div')
  d.className = 'o-panel card'
  var l = document.createElement('span'); l.className = 'o-label'; l.style.margin = '0'; l.textContent = label
  var v = document.createElement('div'); v.className = 'big'; v.textContent = value
  var s = document.createElement('div'); s.className = 'o-sub'; s.style.margin = '0'; s.textContent = sub || ''
  d.append(l, v, s)
  if (pct != null) {
    var m = document.createElement('div'); m.className = 'o-meter'
    var i = document.createElement('i'); i.style.width = pct + '%'
    if (pct > 90) i.style.background = 'var(--o-danger)'
    m.appendChild(i); d.appendChild(m)
  }
  return d
}

function render() {
  if (!info) return
  var loc = outilo.locale
  var b = function (n) { return SysLogic.bytes(n, loc) }
  var cards = $('#cards')
  cards.innerHTML = ''
  cards.append(
    card(outilo.t('os'), info.os, info.hostname),
    card(outilo.t('cpu'), info.cpu, (info.cores || '?') + ' / ' + info.threads + ' ' + outilo.t('threads') + ' · ' + info.frequencyMhz + ' MHz'),
    card(outilo.t('memory'), b(info.memoryUsed) + ' / ' + b(info.memoryTotal), SysLogic.percent(info.memoryUsed, info.memoryTotal) + ' %', SysLogic.percent(info.memoryUsed, info.memoryTotal)),
    card(outilo.t('gpu'), info.gpus.length ? info.gpus[0] : outilo.t('none'), info.gpus.slice(1).join(', ')),
    card(outilo.t('uptime'), SysLogic.duration(info.uptime, loc), outilo.t('arch') + ' ' + info.arch)
  )
  var disks = $('#disks')
  disks.innerHTML = ''
  info.disks.forEach(function (d) {
    var tr = document.createElement('tr')
    var pct = SysLogic.percent(d.total - d.available, d.total)
    ;[d.mount + (d.name ? ' — ' + d.name : '') + (d.removable ? ' (' + outilo.t('removable') + ')' : ''), d.fileSystem + ' · ' + d.kind, b(d.total - d.available) + ' / ' + b(d.total), b(d.available)].forEach(function (v) {
      var td = document.createElement('td'); td.textContent = v; tr.appendChild(td)
    })
    var td = document.createElement('td'); td.style.width = '140px'
    var m = document.createElement('div'); m.className = 'o-meter'
    var i = document.createElement('i'); i.style.width = pct + '%'
    if (pct > 90) i.style.background = 'var(--o-danger)'
    m.appendChild(i); td.appendChild(m); tr.appendChild(td)
    disks.appendChild(tr)
  })
  var details = $('#details')
  details.innerHTML = ''
  ;[
    [outilo.t('os'), info.os + ' ' + info.osVersion],
    [outilo.t('kernel'), info.kernel],
    [outilo.t('swap'), b(info.swapUsed) + ' / ' + b(info.swapTotal)],
    [outilo.t('cpuUsage'), Math.round(info.cpuUsage) + ' %']
  ].forEach(function (r) {
    var tr = document.createElement('tr')
    var k = document.createElement('td'); k.className = 'k'; k.textContent = r[0]
    var v = document.createElement('td'); v.textContent = r[1]
    tr.append(k, v); details.appendChild(tr)
  })
}

async function load() {
  $('#status').textContent = outilo.t('loading')
  $('#status').className = 'o-sub'
  try {
    info = await outilo.system.info()
    $('#status').textContent = outilo.t('updated', { time: new Date().toLocaleTimeString(outilo.locale) })
    render()
  } catch (e) {
    $('#status').textContent = e.message
    $('#status').className = 'o-sub o-err'
  }
}

$('#refresh').addEventListener('click', load)
$('#copy').addEventListener('click', async function () {
  if (!info) return
  await outilo.clipboard.write(SysLogic.summary(info, outilo.locale, labels()))
  outilo.toast(outilo.t('copied'), 'success')
})
$('#save').addEventListener('click', async function () {
  if (!info) return
  if (await outilo.files.save('infos-systeme.txt', SysLogic.summary(info, outilo.locale, labels()))) outilo.toast(outilo.t('saved'), 'success')
})

outilo.onLocale(render)
outilo.onCommand(function (cmd) {
  if (cmd === 'copy-summary') {
    outilo.system.info().then(function (i) {
      info = i
      render()
      return outilo.clipboard.write(SysLogic.summary(i, outilo.locale, labels()))
    }).then(function () { outilo.toast(outilo.t('copied'), 'success') })
  }
})
outilo.ready.then(load)
