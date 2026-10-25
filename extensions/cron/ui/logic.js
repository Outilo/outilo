// Expressions cron à 5 champs (testées par tests/extensions/cron.test.mjs).
;(function (root) {
  'use strict'

  var FIELDS = [
    { id: 'minute', min: 0, max: 59 },
    { id: 'hour', min: 0, max: 23 },
    { id: 'dom', min: 1, max: 31 },
    { id: 'month', min: 1, max: 12, names: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] },
    { id: 'dow', min: 0, max: 7, names: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] }
  ]

  var MACROS = {
    '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0',
    '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *'
  }

  function value(token, f) {
    var up = token.toUpperCase()
    var i = f.names ? f.names.indexOf(up) : -1
    if (i >= 0) return f.id === 'month' ? i + 1 : i
    if (!/^\d+$/.test(token)) throw new Error(token)
    return +token
  }

  function parseField(text, f) {
    var set = {}
    var step = null
    text.split(',').forEach(function (part) {
      var m = /^(\*|[^/-]+(?:-[^/]+)?)(?:\/(\d+))?$/.exec(part)
      if (!m) throw new Error(part)
      var lo = f.min
      var hi = f.max
      if (m[1] !== '*') {
        var range = m[1].split('-')
        lo = value(range[0], f)
        hi = range.length > 1 ? value(range[1], f) : m[2] ? f.max : lo
      }
      var by = m[2] ? +m[2] : 1
      if (lo < f.min || hi > f.max || lo > hi || by < 1) throw new Error(part)
      if (m[1] === '*' && m[2] && text.indexOf(',') < 0) step = by
      for (var v = lo; v <= hi; v += by) set[f.id === 'dow' && v === 7 ? 0 : v] = true
    })
    var values = Object.keys(set).map(Number).sort(function (a, b) { return a - b })
    var size = f.id === 'dow' ? 7 : f.max - f.min + 1
    return { values: values, all: text === '*' || values.length === size, step: step, raw: text }
  }

  function parse(expr) {
    var text = String(expr).trim().replace(/\s+/g, ' ')
    var expanded = MACROS[text.toLowerCase()] || text
    var parts = expanded.split(' ')
    if (parts.length !== 5) return { ok: false, error: 'fields' }
    var out = { ok: true, macro: MACROS[text.toLowerCase()] ? text.toLowerCase() : null }
    for (var i = 0; i < 5; i++) {
      try {
        out[FIELDS[i].id] = parseField(parts[i], FIELDS[i])
      } catch (e) {
        return { ok: false, error: 'field', field: FIELDS[i].id, token: e.message }
      }
    }
    return out
  }

  function has(f, v) { return f.values.indexOf(v) >= 0 }

  function dayMatches(p, d) {
    var dom = has(p.dom, d.getDate())
    var dow = has(p.dow, d.getDay())
    // Règle cron classique : si les deux champs sont restreints, l'un OU l'autre suffit
    if (!p.dom.all && !p.dow.all) return dom || dow
    return dom && dow
  }

  /** Prochaines exécutions (heure locale), strictement après `from`. */
  function next(p, from, count) {
    var out = []
    var d = new Date(from)
    d.setSeconds(0, 0)
    d.setMinutes(d.getMinutes() + 1)
    var guard = 0
    while (out.length < count && guard++ < 200000) {
      if (!has(p.month, d.getMonth() + 1)) { d.setMonth(d.getMonth() + 1, 1); d.setHours(0, 0, 0, 0); continue }
      if (!dayMatches(p, d)) { d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); continue }
      if (!has(p.hour, d.getHours())) { d.setHours(d.getHours() + 1, 0, 0, 0); continue }
      if (!has(p.minute, d.getMinutes())) { d.setMinutes(d.getMinutes() + 1, 0, 0); continue }
      out.push(new Date(d))
      d.setMinutes(d.getMinutes() + 1, 0, 0)
    }
    return out
  }

  // ---------- Description lisible ----------

  var L = {
    fr: {
      everyMinute: 'Chaque minute', everyN: 'Toutes les {n} minutes', everyNBetween: 'Toutes les {n} minutes, de {a} à {b}', atMinute: 'À la minute {m} de chaque heure',
      everyNHours: 'Toutes les {n} heures, à la minute {m}', at: 'À {list}', minutesHours: 'Aux minutes {m} des heures {h}',
      everyDay: 'tous les jours', onDow: 'le {list}', dowRange: 'du {a} au {b}', onDom: 'le {list} du mois', and: ' et ', or: ' ou ',
      inMonths: 'en {list}', first: '1er',
      days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
      months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
    },
    en: {
      everyMinute: 'Every minute', everyN: 'Every {n} minutes', everyNBetween: 'Every {n} minutes, from {a} to {b}', atMinute: 'At minute {m} past every hour',
      everyNHours: 'Every {n} hours, at minute {m}', at: 'At {list}', minutesHours: 'At minutes {m} of hours {h}',
      everyDay: 'every day', onDow: 'on {list}', dowRange: '{a} through {b}', onDom: 'on day {list} of the month', and: ' and ', or: ' or ',
      inMonths: 'in {list}', first: '1',
      days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    }
  }

  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k] }) }
  function join(list, t) { return list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + t.and + list[list.length - 1] }
  function pad(n) { return String(n).padStart(2, '0') }
  function contiguous(v) { return v.length > 1 && v[v.length - 1] - v[0] === v.length - 1 }

  function describe(p, lang) {
    var t = L[lang] || L.fr
    var time
    var mi = p.minute
    var ho = p.hour
    if (mi.all && ho.all) time = t.everyMinute
    else if (mi.step && ho.all) time = fill(t.everyN, { n: mi.step })
    else if (mi.step && contiguous(ho.values)) {
      time = fill(t.everyNBetween, { n: mi.step, a: pad(ho.values[0]) + ':00', b: pad(ho.values[ho.values.length - 1]) + ':' + pad(mi.values[mi.values.length - 1]) })
    }
    else if (mi.values.length === 1 && ho.all) time = fill(t.atMinute, { m: mi.values[0] })
    else if (mi.values.length === 1 && ho.step) time = fill(t.everyNHours, { n: ho.step, m: mi.values[0] })
    else if (mi.values.length * ho.values.length <= 6) {
      var times = []
      ho.values.forEach(function (h) { mi.values.forEach(function (m) { times.push(pad(h) + ':' + pad(m)) }) })
      time = fill(t.at, { list: join(times, t) })
    } else time = fill(t.minutesHours, { m: mi.raw, h: ho.raw })

    var days = []
    if (!p.dom.all) days.push(fill(t.onDom, { list: join(p.dom.values.map(function (d) { return d === 1 ? t.first : String(d) }), t) }))
    if (!p.dow.all) {
      var v = p.dow.values
      days.push(v.length > 2 && contiguous(v) ? fill(t.dowRange, { a: t.days[v[0]], b: t.days[v[v.length - 1]] }) : fill(t.onDow, { list: join(v.map(function (d) { return t.days[d] }), t) }))
    }
    var dayText = days.length ? days.join(t.or) : p.month.all ? t.everyDay : ''
    var monthText = p.month.all ? '' : fill(t.inMonths, { list: join(p.month.values.map(function (m) { return t.months[m - 1] }), t) })
    return [time, dayText, monthText].filter(Boolean).join(', ')
  }

  root.CronLogic = { parse: parse, next: next, describe: describe, FIELDS: FIELDS, MACROS: MACROS }
})(typeof window !== 'undefined' ? window : globalThis)
