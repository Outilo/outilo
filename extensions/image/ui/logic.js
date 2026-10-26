// Conversion d'images (testée par tests/extensions/image.test.mjs) ; le dessin se fait dans un canvas.
;(function (root) {
  'use strict'

  var FORMATS = {
    png: { mime: 'image/png', ext: 'png', lossy: false },
    jpeg: { mime: 'image/jpeg', ext: 'jpg', lossy: true },
    webp: { mime: 'image/webp', ext: 'webp', lossy: true }
  }

  /** Taille cible : largeur et/ou hauteur demandées, proportions conservées si `keep`. */
  function targetSize(w, h, opts) {
    var tw = Number(opts.width) || 0
    var th = Number(opts.height) || 0
    if (opts.rotate === 90 || opts.rotate === 270) { var t = w; w = h; h = t }
    if (!tw && !th) return { width: w, height: h }
    if (opts.keep !== false) {
      if (tw && !th) th = (h * tw) / w
      else if (th && !tw) tw = (w * th) / h
      else { var r = Math.min(tw / w, th / h); tw = w * r; th = h * r }
    }
    return { width: Math.max(1, Math.round(tw || w)), height: Math.max(1, Math.round(th || h)) }
  }

  function outName(name, format) {
    var base = String(name || 'image').replace(/\.[^.]+$/, '')
    return base + '.' + FORMATS[format].ext
  }

  function bytes(n, locale) {
    var u = locale === 'en' ? ['B', 'KB', 'MB'] : ['o', 'Ko', 'Mo']
    var i = 0
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
    return (i ? n.toFixed(1) : n) + ' ' + u[i]
  }

  /** Taille en octets d'un contenu base64. */
  function base64Size(b64) {
    var pad = (b64.match(/=+$/) || [''])[0].length
    return Math.floor((b64.length * 3) / 4) - pad
  }

  root.ImageLogic = { FORMATS: FORMATS, targetSize: targetSize, outName: outName, bytes: bytes, base64Size: base64Size }
})(typeof window !== 'undefined' ? window : globalThis)
