// Couleurs (testées par tests/extensions/colors.test.mjs) : conversions HEX/RGB/HSL/OKLCH, contraste WCAG, palettes.
;(function (root) {
  'use strict'

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)) }
  function round(v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p }

  // ---------- Conversions ----------

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100
    var k = function (n) { return (n + h / 30) % 12 }
    var a = s * Math.min(l, 1 - l)
    var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))) }
    return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 }
  }

  function rgbToHsl(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255
    var max = Math.max(r, g, b), min = Math.min(r, g, b)
    var l = (max + min) / 2
    var d = max - min
    var h = 0, s = 0
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1))
      h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
      h *= 60
      if (h < 0) h += 360
    }
    return { h: h, s: s * 100, l: l * 100 }
  }

  var toLin = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  var fromLin = function (v) { return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) }

  function rgbToOklch(c) {
    var r = toLin(c.r), g = toLin(c.g), b = toLin(c.b)
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    var L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
    var A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
    var B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    var C = Math.sqrt(A * A + B * B)
    var H = C < 1e-4 ? 0 : (Math.atan2(B, A) * 180) / Math.PI
    return { l: L, c: C, h: H < 0 ? H + 360 : H }
  }

  function oklchToRgb(o) {
    var A = o.c * Math.cos((o.h * Math.PI) / 180)
    var B = o.c * Math.sin((o.h * Math.PI) / 180)
    var l = Math.pow(o.l + 0.3963377774 * A + 0.2158037573 * B, 3)
    var m = Math.pow(o.l - 0.1055613458 * A - 0.0638541728 * B, 3)
    var s = Math.pow(o.l - 0.0894841775 * A - 1.291485548 * B, 3)
    return {
      r: fromLin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      g: fromLin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      b: fromLin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
    }
  }

  function inGamut(c) { return [c.r, c.g, c.b].every(function (v) { return v >= -0.5 && v <= 255.5 }) }

  /** OKLCH → sRGB en réduisant la chroma jusqu'à rentrer dans le gamut. */
  function oklchToRgbClamped(o) {
    var c = { l: clamp(o.l, 0, 1), c: o.c, h: o.h }
    var rgb = oklchToRgb(c)
    while (!inGamut(rgb) && c.c > 0) { c.c = Math.max(0, c.c - 0.005); rgb = oklchToRgb(c) }
    return norm(rgb)
  }

  function norm(c) {
    return { r: Math.round(clamp(c.r, 0, 255)), g: Math.round(clamp(c.g, 0, 255)), b: Math.round(clamp(c.b, 0, 255)), a: c.a == null ? 1 : c.a }
  }

  // ---------- Lecture ----------

  function num(v, max) { return /%$/.test(v) ? (parseFloat(v) / 100) * max : parseFloat(v) }

  function parse(input) {
    var s = String(input).trim().toLowerCase()
    var m
    if ((m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s))) {
      var h = m[1]
      if (h.length <= 4) h = h.split('').map(function (x) { return x + x }).join('')
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? round(parseInt(h.slice(6), 16) / 255, 3) : 1 }
    }
    if ((m = /^(rgba?|hsla?|oklch)\(([^)]+)\)$/.exec(s))) {
      var parts = m[2].replace(/\s*\/\s*/, ' / ').split(/[\s,]+/).filter(function (x) { return x && x !== '/' })
      if (parts.length < 3) return null
      var a = parts[3] != null ? clamp(num(parts[3], 1), 0, 1) : 1
      var out
      if (m[1].indexOf('rgb') === 0) out = { r: num(parts[0], 255), g: num(parts[1], 255), b: num(parts[2], 255) }
      else if (m[1].indexOf('hsl') === 0) out = hslToRgb(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]))
      else out = oklchToRgbClamped({ l: /%$/.test(parts[0]) ? parseFloat(parts[0]) / 100 : parseFloat(parts[0]), c: num(parts[1], 0.4), h: parseFloat(parts[2]) })
      if ([out.r, out.g, out.b].some(isNaN)) return null
      out.a = a
      return norm(out)
    }
    return null
  }

  // ---------- Écriture ----------

  function hex2(v) { return ('0' + Math.round(v).toString(16)).slice(-2) }
  function toHex(c) { return '#' + hex2(c.r) + hex2(c.g) + hex2(c.b) + (c.a < 1 ? hex2(c.a * 255) : '') }
  function alpha(c) { return c.a < 1 ? ' / ' + round(c.a, 2) : '' }
  function toRgb(c) { return 'rgb(' + c.r + ' ' + c.g + ' ' + c.b + alpha(c) + ')' }
  function toHsl(c) { var h = rgbToHsl(c); return 'hsl(' + round(h.h) + ' ' + round(h.s) + '% ' + round(h.l) + '%' + alpha(c) + ')' }
  function toOklch(c) { var o = rgbToOklch(c); return 'oklch(' + round(o.l * 100, 1) + '% ' + round(o.c, 3) + ' ' + round(o.h, 1) + alpha(c) + ')' }

  function formats(c) {
    return [{ id: 'hex', value: toHex(c) }, { id: 'rgb', value: toRgb(c) }, { id: 'hsl', value: toHsl(c) }, { id: 'oklch', value: toOklch(c) }]
  }

  // ---------- Contraste WCAG 2 ----------

  function luminance(c) { return 0.2126 * toLin(c.r) + 0.7152 * toLin(c.g) + 0.0722 * toLin(c.b) }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b)
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  }

  function wcag(ratio) {
    return { aa: ratio >= 4.5, aaLarge: ratio >= 3, aaa: ratio >= 7, aaaLarge: ratio >= 4.5 }
  }

  /** Texte lisible (noir ou blanc) sur cette couleur. */
  function ink(c) { return contrast(c, { r: 0, g: 0, b: 0 }) >= contrast(c, { r: 255, g: 255, b: 255 }) ? '#000000' : '#ffffff' }

  // ---------- Palettes (en OKLCH, perceptuellement régulières) ----------

  function palette(c, kind) {
    var o = rgbToOklch(c)
    var at = function (l, ch, h) { return toHex(oklchToRgbClamped({ l: l, c: ch, h: ((h % 360) + 360) % 360 })) }
    switch (kind) {
      case 'shades':
        return [0.97, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.13].map(function (l) { return at(l, o.c * (1 - Math.abs(l - 0.6) * 0.6), o.h) })
      case 'complementary':
        return [toHex(c), at(o.l, o.c, o.h + 180)]
      case 'analogous':
        return [-60, -30, 0, 30, 60].map(function (d) { return d ? at(o.l, o.c, o.h + d) : toHex(c) })
      case 'triadic':
        return [0, 120, 240].map(function (d) { return d ? at(o.l, o.c, o.h + d) : toHex(c) })
      default:
        return []
    }
  }

  root.ColorLogic = {
    parse: parse, formats: formats, toHex: toHex, rgbToHsl: rgbToHsl, hslToRgb: hslToRgb, rgbToOklch: rgbToOklch,
    oklchToRgb: oklchToRgbClamped, contrast: contrast, wcag: wcag, ink: ink, palette: palette, luminance: luminance
  }
})(typeof window !== 'undefined' ? window : globalThis)
