/* global outilo, NetLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Réseau', subtitle: 'Adresses IP, ping, résolution DNS, test de port et cache DNS.',
    publicIp: 'IP publique', publicHint: 'Demandée à api.ipify.org', get: 'Obtenir', clickCopy: 'Cliquer pour copier',
    dnsCache: 'Cache DNS', flushHint: 'Équivalent de « ipconfig /flushdns », utile après un changement de DNS ou de fichier hosts.',
    flush: 'Vider le cache DNS', flushed: 'Cache DNS vidé', iface: 'Interface', addresses: 'Adresses', hostHint: 'Nom d’hôte ou adresse IP',
    dns: 'DNS', tcp: 'Tester le port', copied: 'Copié', invalidHost: 'Nom d’hôte invalide', working: '…',
    pingLine: 'Réponse de {ip} : {ms} ms', pingLost: 'Délai dépassé (code {status})',
    pingStats: '{received}/{sent} reçus, {loss} % de perte · min {min} ms, moy. {avg} ms, max {max} ms',
    resolved: '{host} → {n} adresse(s) en {ms} ms', open: '✓ Port {port} ouvert sur {addr} ({ms} ms)', closed: '✗ Port {port} fermé ou filtré sur {addr} : {error}',
    private: 'privée'
  },
  en: {
    title: 'Network', subtitle: 'IP addresses, ping, DNS lookup, port test and DNS cache.',
    publicIp: 'Public IP', publicHint: 'Requested from api.ipify.org', get: 'Get', clickCopy: 'Click to copy',
    dnsCache: 'DNS cache', flushHint: 'Same as “ipconfig /flushdns”, handy after changing DNS or the hosts file.',
    flush: 'Flush DNS cache', flushed: 'DNS cache flushed', iface: 'Interface', addresses: 'Addresses', hostHint: 'Host name or IP address',
    dns: 'DNS', tcp: 'Test port', copied: 'Copied', invalidHost: 'Invalid host name', working: '…',
    pingLine: 'Reply from {ip}: {ms} ms', pingLost: 'Request timed out (code {status})',
    pingStats: '{received}/{sent} received, {loss}% loss · min {min} ms, avg {avg} ms, max {max} ms',
    resolved: '{host} → {n} address(es) in {ms} ms', open: '✓ Port {port} open on {addr} ({ms} ms)', closed: '✗ Port {port} closed or filtered on {addr}: {error}',
    private: 'private'
  }
}

var $ = function (s) { return document.querySelector(s) }

function out(text, error) {
  $('#out').textContent = text
  $('#out').className = 'o-pre' + (error ? ' o-err' : '')
}

function host() {
  var t = NetLogic.target($('#host').value, +$('#port').value || 443)
  if (!NetLogic.validHost(t.host)) { out(outilo.t('invalidHost'), true); return null }
  return t
}

async function guard(fn) {
  out(outilo.t('working'))
  try { await fn() } catch (e) { out(e.message, true) }
}

$('#ping').addEventListener('click', function () {
  var t = host()
  if (!t) return
  guard(async function () {
    var r = await outilo.net.ping(t.host, 4)
    var lines = r.replies.map(function (x) { return x.ok ? outilo.t('pingLine', { ip: r.address, ms: x.ms }) : outilo.t('pingLost', { status: x.status }) })
    var s = NetLogic.pingStats(r.replies)
    lines.push('', outilo.t('pingStats', { received: s.received, sent: s.sent, loss: s.loss, min: s.min == null ? '—' : s.min, avg: s.avg == null ? '—' : s.avg, max: s.max == null ? '—' : s.max }))
    out(lines.join('\n'), !s.received)
  })
})

$('#dns').addEventListener('click', function () {
  var t = host()
  if (!t) return
  guard(async function () {
    var r = await outilo.net.lookup(t.host)
    out(outilo.t('resolved', { host: t.host, n: r.addresses.length, ms: r.ms }) + '\n\n' + r.addresses.join('\n'))
  })
})

$('#tcp').addEventListener('click', function () {
  var t = host()
  if (!t) return
  guard(async function () {
    var r = await outilo.net.tcp(t.host, t.port, 3000)
    out(r.open ? outilo.t('open', { port: t.port, addr: r.address, ms: r.ms }) : outilo.t('closed', { port: t.port, addr: r.address, error: r.error }), !r.open)
  })
})

$('#getPublic').addEventListener('click', async function () {
  $('#publicIp').textContent = outilo.t('working')
  try {
    var r = await outilo.net.fetch('https://api.ipify.org?format=json')
    $('#publicIp').textContent = JSON.parse(r.body).ip
  } catch (e) {
    $('#publicIp').textContent = '—'
    outilo.toast(e.message, 'error')
  }
})
$('#publicIp').addEventListener('click', async function () {
  var ip = this.textContent
  if (!/[\d:.]{3,}/.test(ip)) return
  await outilo.clipboard.write(ip)
  outilo.toast(outilo.t('copied'), 'success')
})

$('#flush').addEventListener('click', async function () {
  try {
    await outilo.shell.flushDns()
    outilo.toast(outilo.t('flushed'), 'success')
  } catch (e) {
    outilo.toast(e.message, 'error')
  }
})

async function interfaces() {
  var tbody = $('#ifaces')
  try {
    var list = await outilo.net.interfaces()
    tbody.innerHTML = ''
    list.forEach(function (i) {
      var tr = document.createElement('tr')
      var addrs = i.addresses.map(function (a) { return a + (NetLogic.isPrivate(a) ? ' (' + outilo.t('private') + ')' : '') })
      ;[i.name, addrs.join('\n'), i.mac].forEach(function (v) {
        var td = document.createElement('td'); td.textContent = v; td.style.whiteSpace = 'pre'; tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
  } catch (e) {
    out(e.message, true)
  }
}

$('#host').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#ping').click() })
outilo.onLocale(interfaces)
outilo.ready.then(interfaces)
