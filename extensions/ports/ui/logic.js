// Filtres et tris des ports / processus (testés par tests/extensions/ports.test.mjs).
;(function (root) {
  'use strict'

  /** Port en écoute : TCP LISTEN, ou UDP lié (pas de notion d'état). */
  function listening(p) { return p.protocol === 'UDP' || p.state === 'LISTEN' }

  /** query : numéro de port exact, ou texte cherché dans le processus / l'adresse. */
  function filterPorts(list, query, listeningOnly) {
    var q = String(query || '').trim().toLowerCase().replace(/^:/, '')
    var exactPort = /^\d+$/.test(q) ? +q : null
    var seen = {}
    return list.filter(function (p) {
      if (listeningOnly && !listening(p)) return false
      if (exactPort != null) { if (p.localPort !== exactPort) return false }
      else if (q && (p.process + ' ' + p.localAddr + ' ' + p.pid + ' ' + p.state).toLowerCase().indexOf(q) < 0) return false
      // IPv4 et IPv6 du même processus sur le même port : une seule ligne
      var key = [p.protocol, p.localPort, p.pid, p.state, listening(p) ? '' : p.remoteAddr + ':' + p.remotePort].join('|')
      if (seen[key]) return false
      seen[key] = true
      return true
    })
  }

  /** sort : memory, cpu, name ou pid. */
  function filterProcesses(list, query, sort) {
    var q = String(query || '').trim().toLowerCase()
    var out = list.filter(function (p) { return !q || (p.name + ' ' + p.pid + ' ' + p.exe).toLowerCase().indexOf(q) >= 0 })
    var by = {
      memory: function (a, b) { return b.memory - a.memory },
      cpu: function (a, b) { return b.cpu - a.cpu },
      name: function (a, b) { return a.name.localeCompare(b.name) },
      pid: function (a, b) { return a.pid - b.pid }
    }[sort || 'memory']
    return out.sort(by)
  }

  function bytes(n) {
    var u = ['o', 'Ko', 'Mo', 'Go']
    var i = 0
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
    return (i ? n.toFixed(n < 10 ? 1 : 0) : n) + ' ' + u[i]
  }

  root.PortsLogic = { listening: listening, filterPorts: filterPorts, filterProcesses: filterProcesses, bytes: bytes }
})(typeof window !== 'undefined' ? window : globalThis)
