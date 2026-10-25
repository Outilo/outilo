// Encodages texte (testés par tests/extensions/encoders.test.mjs). Tout est en UTF-8.
;(function (root) {
  'use strict'

  var utf8 = new TextEncoder()
  var fromUtf8 = new TextDecoder('utf-8', { fatal: true })

  function bytesToBase64(bytes) {
    var s = ''
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    return btoa(s)
  }

  function base64ToBytes(b64) {
    var clean = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error('base64')
    while (clean.length % 4) clean += '='
    var bin = atob(clean)
    var out = new Uint8Array(bin.length)
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }

  var HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  var NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', euro: '€', copy: '©', reg: '®' }

  var codecs = {
    base64: {
      encode: function (s) { return bytesToBase64(utf8.encode(s)) },
      decode: function (s) { return fromUtf8.decode(base64ToBytes(s)) }
    },
    base64url: {
      encode: function (s) { return codecs.base64.encode(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') },
      decode: function (s) { return codecs.base64.decode(s) }
    },
    url: {
      encode: function (s) { return encodeURIComponent(s) },
      decode: function (s) { return decodeURIComponent(s.replace(/\+/g, ' ')) }
    },
    html: {
      encode: function (s, all) {
        return s.replace(all ? /[&<>"']|[^\x20-\x7e\n\r\t]/gu : /[&<>"']/g, function (c) {
          return HTML[c] || '&#' + c.codePointAt(0) + ';'
        })
      },
      decode: function (s) {
        return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (m, e) {
          if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1))
          return NAMED[e.toLowerCase()] != null ? NAMED[e.toLowerCase()] : m
        })
      }
    },
    hex: {
      encode: function (s) {
        return Array.prototype.map.call(utf8.encode(s), function (b) { return (b < 16 ? '0' : '') + b.toString(16) }).join(' ')
      },
      decode: function (s) {
        var clean = s.replace(/0x/gi, '').replace(/[\s:,-]/g, '')
        if (clean.length % 2 || /[^0-9a-f]/i.test(clean)) throw new Error('hex')
        var out = new Uint8Array(clean.length / 2)
        for (var i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16)
        return fromUtf8.decode(out)
      }
    },
    unicode: {
      encode: function (s) {
        var out = ''
        for (var i = 0; i < s.length; i++) {
          var c = s.charCodeAt(i)
          out += c < 128 ? s[i] : '\\u' + ('000' + c.toString(16)).slice(-4)
        }
        return out
      },
      decode: function (s) {
        return s.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})/gi, function (m, a, b) { return String.fromCodePoint(parseInt(a || b, 16)) })
      }
    }
  }

  /** Renvoie { ok, value } ou { ok: false } si l'entrée n'est pas décodable. */
  function run(codec, direction, text, opts) {
    try {
      return { ok: true, value: codecs[codec][direction](text, opts && opts.all) }
    } catch (e) {
      return { ok: false }
    }
  }

  root.EncLogic = { run: run, codecs: Object.keys(codecs), bytesToBase64: bytesToBase64, base64ToBytes: base64ToBytes }
})(typeof window !== 'undefined' ? window : globalThis)
