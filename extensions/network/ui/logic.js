// Outils réseau (testés par tests/extensions/network.test.mjs). Les accès passent par l'API outilo.net.
;(function (root) {
  'use strict'

  /** Nom d'hôte, IPv4 ou IPv6 plausible (la résolution réelle est faite par le cœur). */
  function validHost(h) {
    h = String(h).trim()
    if (!h || h.length > 253) return false
    if (/^[0-9a-f:]+$/i.test(h) && h.indexOf(':') >= 0) return true
    return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.?$/i.test(h)
  }

  /** Accepte « hôte », « hôte:port », une URL, et renvoie { host, port }. */
  function target(input, defaultPort) {
    var s = String(input).trim()
    try {
      if (/^[a-z]+:\/\//i.test(s)) {
        var u = new URL(s)
        return { host: u.hostname.replace(/^\[|\]$/g, ''), port: +u.port || (u.protocol === 'https:' ? 443 : u.protocol === 'http:' ? 80 : defaultPort) }
      }
    } catch (e) { /* pas une URL : on continue */ }
    // IPv6 nue (plusieurs « : » sans crochets) : pas de port possible
    if (s[0] !== '[' && s.split(':').length > 2) return { host: s, port: defaultPort }
    var m = /^\[?([^\]]+?)\]?(?::(\d+))?$/.exec(s)
    if (!m) return { host: s, port: defaultPort }
    return { host: m[1], port: m[2] ? +m[2] : defaultPort }
  }

  function pingStats(replies) {
    var ok = replies.filter(function (r) { return r.ok })
    var times = ok.map(function (r) { return r.ms })
    return {
      sent: replies.length,
      received: ok.length,
      loss: replies.length ? Math.round(((replies.length - ok.length) / replies.length) * 100) : 0,
      min: times.length ? Math.min.apply(null, times) : null,
      max: times.length ? Math.max.apply(null, times) : null,
      avg: times.length ? Math.round(times.reduce(function (a, b) { return a + b }, 0) / times.length) : null
    }
  }

  function isPrivate(ip) {
    return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|169\.254\.|fe80:|fc|fd|::1$)/i.test(ip)
  }

  root.NetLogic = { validHost: validHost, target: target, pingStats: pingStats, isPrivate: isPrivate }
})(typeof window !== 'undefined' ? window : globalThis)
