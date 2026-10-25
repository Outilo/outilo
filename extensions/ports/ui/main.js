/* global outilo, PortsLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Ports & processus', subtitle: '« Qui utilise le port 3000 ? », processus en cours, arrêt avec confirmation.',
    ports: 'Ports', procs: 'Processus', queryHint: 'Numéro de port, nom de processus…', listening: 'En écoute seulement',
    byMemory: 'Tri : mémoire', byCpu: 'Tri : processeur', byName: 'Tri : nom', auto: 'Actualiser', refresh: 'Rafraîchir',
    proto: 'Proto', local: 'Adresse locale', port: 'Port', state: 'État', remote: 'Distante', process: 'Processus',
    memory: 'Mémoire', cpu: 'Processeur', path: 'Chemin', kill: 'Arrêter', killed: '{name} arrêté',
    countPorts: '{n} socket(s)', countProcs: '{n} processus', free: 'Le port {port} est libre', unknown: 'inconnu (système)',
    loading: 'Lecture…'
  },
  en: {
    title: 'Ports & processes', subtitle: '“Who is using port 3000?”, running processes, stop with confirmation.',
    ports: 'Ports', procs: 'Processes', queryHint: 'Port number, process name…', listening: 'Listening only',
    byMemory: 'Sort: memory', byCpu: 'Sort: CPU', byName: 'Sort: name', auto: 'Auto refresh', refresh: 'Refresh',
    proto: 'Proto', local: 'Local address', port: 'Port', state: 'State', remote: 'Remote', process: 'Process',
    memory: 'Memory', cpu: 'CPU', path: 'Path', kill: 'Stop', killed: '{name} stopped',
    countPorts: '{n} socket(s)', countProcs: '{n} process(es)', free: 'Port {port} is free', unknown: 'unknown (system)',
    loading: 'Reading…'
  }
}

var $ = function (s) { return document.querySelector(s) }
var tab = 'ports'
var data = { ports: [], procs: [] }
var timer

function cell(tr, text, cls) {
  var td = document.createElement('td')
  td.textContent = text
  if (cls) td.className = cls
  tr.appendChild(td)
  return td
}

function killButton(tr, pid, name) {
  var td = document.createElement('td')
  if (pid && pid > 4) {
    var b = document.createElement('button')
    b.className = 'o-btn o-btn--sm'
    b.textContent = outilo.t('kill')
    b.addEventListener('click', async function () {
      try {
        if (await outilo.process.kill(pid)) {
          outilo.toast(outilo.t('killed', { name: name || pid }), 'success')
          load()
        }
      } catch (e) {
        outilo.toast(e.message, 'error')
      }
    })
    td.appendChild(b)
  }
  tr.appendChild(td)
}

function render() {
  var q = $('#query').value
  var status = $('#status')
  if (tab === 'ports') {
    var list = PortsLogic.filterPorts(data.ports, q, $('#listening').checked)
    var tbody = $('#portRows')
    tbody.innerHTML = ''
    list.slice(0, 500).forEach(function (p) {
      var tr = document.createElement('tr')
      cell(tr, p.protocol, 'dim')
      cell(tr, p.localAddr)
      cell(tr, String(p.localPort))
      cell(tr, p.state, 'dim')
      cell(tr, p.remotePort ? p.remoteAddr + ':' + p.remotePort : '', 'dim')
      cell(tr, p.pid == null ? '' : String(p.pid), 'dim')
      cell(tr, p.process || outilo.t('unknown'))
      killButton(tr, p.pid, p.process)
      tbody.appendChild(tr)
    })
    var port = /^:?\d+$/.test(q.trim()) ? q.trim().replace(':', '') : null
    status.textContent = port && !list.length ? outilo.t('free', { port: port }) : outilo.t('countPorts', { n: list.length })
    status.className = 'o-sub' + (port && !list.length ? ' o-ok' : '')
  } else {
    var procs = PortsLogic.filterProcesses(data.procs, q, $('#sort').value)
    var body = $('#procRows')
    body.innerHTML = ''
    procs.slice(0, 500).forEach(function (p) {
      var tr = document.createElement('tr')
      cell(tr, String(p.pid), 'dim')
      cell(tr, p.name)
      cell(tr, PortsLogic.bytes(p.memory))
      cell(tr, p.cpu.toFixed(1) + ' %')
      cell(tr, p.exe, 'path').title = p.exe
      killButton(tr, p.pid, p.name)
      body.appendChild(tr)
    })
    status.textContent = outilo.t('countProcs', { n: procs.length })
    status.className = 'o-sub'
  }
}

async function load() {
  if (!data.ports.length && !data.procs.length) $('#status').textContent = outilo.t('loading')
  try {
    if (tab === 'ports') data.ports = await outilo.process.ports()
    else data.procs = await outilo.process.list()
    render()
  } catch (e) {
    $('#status').textContent = e.message
    $('#status').className = 'o-sub o-err'
  }
}

function setTab(t) {
  tab = t
  document.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t) })
  $('#portsView').classList.toggle('hidden', t !== 'ports')
  $('#procsView').classList.toggle('hidden', t !== 'procs')
  $('#listenOpt').classList.toggle('hidden', t !== 'ports')
  $('#sort').classList.toggle('hidden', t !== 'procs')
  load()
}

document.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab) }) })
$('#query').addEventListener('input', render)
$('#listening').addEventListener('change', render)
$('#sort').addEventListener('change', render)
$('#refresh').addEventListener('click', load)
$('#auto').addEventListener('change', function () {
  clearInterval(timer)
  if (this.checked) timer = setInterval(load, 3000)
})

outilo.onLocale(render)
outilo.onCommand(function (cmd) {
  if (cmd === 'who-port') { setTab('ports'); $('#query').focus() }
})
outilo.ready.then(function () { setTab('ports'); $('#query').focus() })
