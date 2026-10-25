// QR codes (testés par tests/extensions/qr.test.mjs). Encodage : qrcode-generator (MIT, Kazuhiko Arase), dans vendor/.
;(function (root) {
  'use strict'

  /** Échappement des champs Wi-Fi : \ ; , : " */
  function esc(s) { return String(s).replace(/([\\;,:"])/g, '\\$1') }

  function wifi(o) {
    var type = o.security === 'nopass' ? 'nopass' : o.security || 'WPA'
    return 'WIFI:T:' + type + ';S:' + esc(o.ssid) + ';' + (type !== 'nopass' ? 'P:' + esc(o.password) + ';' : '') + (o.hidden ? 'H:true;' : '') + ';'
  }

  function email(o) {
    var q = []
    if (o.subject) q.push('subject=' + encodeURIComponent(o.subject))
    if (o.body) q.push('body=' + encodeURIComponent(o.body))
    return 'mailto:' + o.to + (q.length ? '?' + q.join('&') : '')
  }

  /** Matrice de modules : { size, dark(r, c) }. ecc : L, M, Q ou H. */
  function matrix(text, ecc) {
    var qrcode = root.qrcode
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']
    var qr = qrcode(0, ecc || 'M')
    qr.addData(text, 'Byte')
    qr.make()
    var size = qr.getModuleCount()
    return { size: size, dark: function (r, c) { return qr.isDark(r, c) } }
  }

  /** SVG autonome ; margin en modules (4 recommandé). */
  function svg(m, o) {
    var margin = o.margin == null ? 4 : o.margin
    var full = m.size + margin * 2
    var path = ''
    for (var r = 0; r < m.size; r++) {
      for (var c = 0; c < m.size; c++) if (m.dark(r, c)) path += 'M' + (c + margin) + ' ' + (r + margin) + 'h1v1h-1z'
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + full + ' ' + full + '" width="' + o.px + '" height="' + o.px +
      '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="' + o.bg + '"/><path fill="' + o.fg + '" d="' + path + '"/></svg>'
  }

  root.QrLogic = { wifi: wifi, email: email, matrix: matrix, svg: svg }
})(typeof window !== 'undefined' ? window : globalThis)
