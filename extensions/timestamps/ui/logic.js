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

  root.TsLogic = { parse: parse, isoWeek: isoWeek, dayOfYear: dayOfYear, relative: relative, offset: offset, isoInZone: isoInZone, formats: formats }
})(typeof window !== 'undefined' ? window : globalThis)
