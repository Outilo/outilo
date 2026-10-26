// Minuteur, chronomètre, pomodoro (testés par tests/extensions/timer.test.mjs).
;(function (root) {
  'use strict'

  /** « 25 », « 25:00 », « 1:02:03 », « 1h30 », « 90s », « 2m30s » → millisecondes (null si illisible). */
  function parseDuration(input) {
    var s = String(input).trim().toLowerCase().replace(/\s+/g, '')
    if (!s) return null
    if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60000)
    if (/^\d+(:\d{1,2}){1,2}$/.test(s)) {
      var p = s.split(':').map(Number)
      if (p.slice(1).some(function (x) { return x > 59 })) return null
      return (p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]) * 1000
    }
    var m = /^(?:(\d+)h)?(?:(\d+)(?:m|min))?(?:(\d+)s)?$/.exec(s.replace(/h(\d+)$/, 'h$1m'))
    if (!m || !(m[1] || m[2] || m[3])) return null
    return ((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)) * 1000
  }

  function pad(n) { return String(n).padStart(2, '0') }

  /** 3723400 → « 1:02:03 » ; avec dixièmes pour le chronomètre. */
  function format(ms, tenths) {
    var neg = ms < 0
    ms = Math.abs(ms)
    var total = tenths ? Math.floor(ms / 100) : Math.ceil(ms / 1000) * 10
    var t = Math.floor(total / 10)
    var h = Math.floor(t / 3600)
    var m = Math.floor((t % 3600) / 60)
    var s = t % 60
    var out = (h ? h + ':' + pad(m) : String(m)) + ':' + pad(s) + (tenths ? '.' + (total % 10) : '')
    return (neg ? '-' : '') + out
  }

  /**
   * Phase pomodoro à `elapsed` ms du début : travail, pause courte, et pause longue toutes les `every` sessions.
   * Renvoie { kind: 'work'|'short'|'long', index, remaining }.
   */
  function pomodoro(elapsed, cfg) {
    var work = cfg.work * 60000
    var short = cfg.short * 60000
    var long = cfg.long * 60000
    var every = cfg.every || 4
    var cycle = every * work + (every - 1) * short + long
    var t = elapsed % cycle
    var round = Math.floor(elapsed / cycle) * every
    for (var i = 0; i < every; i++) {
      if (t < work) return { kind: 'work', index: round + i + 1, remaining: work - t }
      t -= work
      var pause = i === every - 1 ? long : short
      if (t < pause) return { kind: i === every - 1 ? 'long' : 'short', index: round + i + 1, remaining: pause - t }
      t -= pause
    }
    return { kind: 'work', index: round + 1, remaining: work }
  }

  root.TimerLogic = { parseDuration: parseDuration, format: format, pomodoro: pomodoro }
})(typeof window !== 'undefined' ? window : globalThis)
