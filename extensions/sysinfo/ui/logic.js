// Mise en forme des informations système (testée par tests/extensions/sysinfo.test.mjs).
;(function (root) {
  'use strict'

  function bytes(n, locale) {
    var units = locale === 'en' ? ['B', 'KB', 'MB', 'GB', 'TB'] : ['o', 'Ko', 'Mo', 'Go', 'To']
    var i = 0
    var v = n
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
    return (i ? v.toFixed(v < 10 ? 1 : 0) : String(v)) + ' ' + units[i]
  }

  function duration(seconds, locale) {
    var d = Math.floor(seconds / 86400)
    var h = Math.floor((seconds % 86400) / 3600)
    var m = Math.floor((seconds % 3600) / 60)
    var u = locale === 'en' ? ['d', 'h', 'min'] : ['j', 'h', 'min']
    return (d ? d + ' ' + u[0] + ' ' : '') + (d || h ? h + ' ' + u[1] + ' ' : '') + m + ' ' + u[2]
  }

  function percent(used, total) { return total ? Math.round((used / total) * 100) : 0 }

  /** Résumé texte à coller dans un ticket de support. */
  function summary(info, locale, labels) {
    var l = labels
    var lines = [
      l.os + ' : ' + info.os + (info.osVersion ? ' (' + info.osVersion + ')' : ''),
      l.host + ' : ' + info.hostname,
      l.cpu + ' : ' + info.cpu + ' — ' + (info.cores || '?') + ' / ' + info.threads + ' ' + l.threads + ', ' + info.frequencyMhz + ' MHz',
      l.memory + ' : ' + bytes(info.memoryUsed, locale) + ' / ' + bytes(info.memoryTotal, locale) + ' (' + percent(info.memoryUsed, info.memoryTotal) + ' %)'
    ]
    if (info.gpus.length) lines.push(l.gpu + ' : ' + info.gpus.join(', '))
    info.disks.forEach(function (d) {
      lines.push(l.disk + ' ' + d.mount + ' : ' + bytes(d.total - d.available, locale) + ' / ' + bytes(d.total, locale) + ' (' + d.fileSystem + ', ' + d.kind + ')')
    })
    lines.push(l.uptime + ' : ' + duration(info.uptime, locale))
    lines.push(l.arch + ' : ' + info.arch + ' · ' + l.kernel + ' ' + info.kernel)
    return lines.join('\n')
  }

  root.SysLogic = { bytes: bytes, duration: duration, percent: percent, summary: summary }
})(typeof window !== 'undefined' ? window : globalThis)
