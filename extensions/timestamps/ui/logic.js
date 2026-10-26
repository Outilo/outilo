// Conversions de dates (testées par tests/extensions/timestamps.test.mjs).
;(function (root) {
  'use strict'

  /**
   * Lit un horodatage Unix (secondes, millisecondes, microsecondes ou nanosecondes, détectés au nombre
   * de chiffres), une date ISO 8601 / RFC 2822, ou « now ». Renvoie un Date ou null.
   */
  function parse(input, now) {
    var s = String(input).trim()
    if (!s) return null
    if (/^(now|maintenant)$/i.test(s)) return new Date(now == null ? Date.now() : now)
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      var digits = s.replace(/^-/, '').split('.')[0].length
      var n = Number(s)
      var ms = digits <= 11 ? n * 1000 : digits <= 14 ? n : digits <= 17 ? n / 1000 : n / 1e6
      var d = new Date(ms)
      return isNaN(d) ? null : d
    }
    var parsed = new Date(s)
    return isNaN(parsed) ? null : parsed
  }

  /** Numéro de semaine ISO 8601 (semaine du jeudi). */
  function isoWeek(date) {
    var d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    var day = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - day)
    var yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
    return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7) }
  }

  function dayOfYear(date) {
    return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000) + 1
  }

  var UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]]

  function relative(date, now, locale) {
    var diff = (date - now) / 1000
    var rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    for (var i = 0; i < UNITS.length; i++) {
      if (Math.abs(diff) >= UNITS[i][1] || UNITS[i][0] === 'second') return rtf.format(Math.round(diff / UNITS[i][1]), UNITS[i][0])
    }
  }

  /** Décalage horaire d'un fuseau à une date donnée, ex. « +02:00 ». */
  function offset(date, timeZone) {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: timeZone, timeZoneName: 'longOffset' }).formatToParts(date)
    var name = (parts.find(function (p) { return p.type === 'timeZoneName' }) || {}).value || 'GMT'
    var m = /GMT([+-]\d{2}):?(\d{2})?/.exec(name)
    return m ? m[1] + ':' + (m[2] || '00') : '+00:00'
  }

  /** ISO 8601 avec le décalage du fuseau, ex. 2026-10-25T20:00:00+02:00. */
  function isoInZone(date, timeZone) {
    var p = {}
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).forEach(function (x) { p[x.type] = x.value })
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute + ':' + p.second + offset(date, timeZone)
  }

  function formats(date, now, locale, timeZone) {
    var week = isoWeek(date)
    return [
      { id: 'unix', value: String(Math.floor(date.getTime() / 1000)) },
      { id: 'unixMs', value: String(date.getTime()) },
      { id: 'iso', value: date.toISOString() },
      { id: 'isoLocal', value: isoInZone(date, timeZone) },
      { id: 'rfc', value: date.toUTCString() },
      { id: 'local', value: new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'long', timeZone: timeZone }).format(date) },
      { id: 'relative', value: relative(date, now, locale) },
      { id: 'week', value: week.year + '-W' + String(week.week).padStart(2, '0') + ' · ' + dayOfYear(date) }
    ]
  }

  // ---------- Formatage par motif (YYYY-MM-DD HH:mm…) ----------

  var TOKENS = /YYYY|YY|MMMM|MMM|MM|M|DDDD|DDD|DD|D|dddd|ddd|HH|H|hh|h|mm|m|ss|s|SSS|A|Z|\[[^\]]*\]/g

  function parts(date, locale) {
    var p = {}
    p.Y = date.getFullYear(); p.M = date.getMonth() + 1; p.D = date.getDate(); p.H = date.getHours()
    p.m = date.getMinutes(); p.s = date.getSeconds(); p.S = date.getMilliseconds(); p.w = date.getDay()
    p.monthLong = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date)
    p.monthShort = new Intl.DateTimeFormat(locale, { month: 'short' }).format(date)
    p.dayLong = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date)
    p.dayShort = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)
    var off = -date.getTimezoneOffset()
    p.Z = (off >= 0 ? '+' : '-') + String(Math.floor(Math.abs(off) / 60)).padStart(2, '0') + ':' + String(Math.abs(off) % 60).padStart(2, '0')
    return p
  }

  /** Formate en heure locale selon un motif ; le texte entre crochets est recopié tel quel. */
  function formatPattern(date, pattern, locale) {
    var p = parts(date, locale)
    var two = function (n) { return String(n).padStart(2, '0') }
    var h12 = p.H % 12 || 12
    var map = {
      YYYY: String(p.Y), YY: String(p.Y).slice(-2), MMMM: p.monthLong, MMM: p.monthShort, MM: two(p.M), M: String(p.M),
      DD: two(p.D), D: String(p.D), dddd: p.dayLong, ddd: p.dayShort, HH: two(p.H), H: String(p.H), hh: two(h12), h: String(h12),
      mm: two(p.m), m: String(p.m), ss: two(p.s), s: String(p.s), SSS: String(p.S).padStart(3, '0'), A: p.H < 12 ? 'AM' : 'PM', Z: p.Z,
      DDDD: String(dayOfYear(new Date(Date.UTC(p.Y, p.M - 1, p.D)))).padStart(3, '0'), DDD: String(dayOfYear(new Date(Date.UTC(p.Y, p.M - 1, p.D))))
    }
    return String(pattern).replace(TOKENS, function (t) { return t[0] === '[' ? t.slice(1, -1) : map[t] })
  }

  /** Code JavaScript autonome qui produit le même résultat que formatPattern (pour un projet). */
  function codeFor(pattern) {
    var pieces = []
    var last = 0
    String(pattern).replace(TOKENS, function (t, i) {
      if (i > last) pieces.push(JSON.stringify(pattern.slice(last, i)))
      var expr = {
        YYYY: 'd.getFullYear()', YY: 'String(d.getFullYear()).slice(-2)', MM: 'p2(d.getMonth() + 1)', M: '(d.getMonth() + 1)',
        DD: 'p2(d.getDate())', D: 'd.getDate()', HH: 'p2(d.getHours())', H: 'd.getHours()', hh: 'p2(d.getHours() % 12 || 12)',
        h: '(d.getHours() % 12 || 12)', mm: 'p2(d.getMinutes())', m: 'd.getMinutes()', ss: 'p2(d.getSeconds())', s: 'd.getSeconds()',
        SSS: "String(d.getMilliseconds()).padStart(3, '0')", A: "(d.getHours() < 12 ? 'AM' : 'PM')",
        MMMM: "d.toLocaleDateString(locale, { month: 'long' })", MMM: "d.toLocaleDateString(locale, { month: 'short' })",
        dddd: "d.toLocaleDateString(locale, { weekday: 'long' })", ddd: "d.toLocaleDateString(locale, { weekday: 'short' })"
      }[t]
      if (t[0] === '[') pieces.push(JSON.stringify(t.slice(1, -1)))
      else pieces.push(expr || JSON.stringify(t))
      last = i + t.length
    })
    if (last < pattern.length) pieces.push(JSON.stringify(pattern.slice(last)))
    return "function formatDate(d, locale = 'fr-FR') {\n  const p2 = n => String(n).padStart(2, '0')\n  return " +
      (pieces.length ? pieces.join(' + ') : "''") + '\n}'
  }

  root.TsLogic = { formatPattern: formatPattern, codeFor: codeFor, parse: parse, isoWeek: isoWeek, dayOfYear: dayOfYear, relative: relative, offset: offset, isoInZone: isoInZone, formats: formats }
})(typeof window !== 'undefined' ? window : globalThis)
