// Empreintes (testées par tests/extensions/hash.test.mjs). SHA via WebCrypto, MD5 ci-dessous, bcrypt via bcryptjs (vendor/).
;(function (root) {
  'use strict'

  var ALGOS = { 'SHA-1': 'SHA-1', 'SHA-256': 'SHA-256', 'SHA-384': 'SHA-384', 'SHA-512': 'SHA-512' }

  function hex(buf) {
    var b = new Uint8Array(buf)
    var s = ''
    for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16)
    return s
  }

  function base64(buf) {
    var b = new Uint8Array(buf)
    var s = ''
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
    return btoa(s)
  }

  // MD5 (RFC 1321) — obsolète pour la sécurité, utile pour comparer des fichiers.
  var K = []
  for (var i = 0; i < 64; i++) K[i] = (Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0
  var R = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21]

  function md5(bytes) {
    var len = bytes.length
    var words = new Uint32Array((((len + 8) >>> 6) + 1) * 16)
    for (var i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8)
    words[len >> 2] |= 0x80 << ((len % 4) * 8)
    words[words.length - 2] = (len * 8) >>> 0
    words[words.length - 1] = Math.floor(len / 0x20000000)
    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476
    for (var o = 0; o < words.length; o += 16) {
      var a = a0, b = b0, c = c0, d = d0
      for (var j = 0; j < 64; j++) {
        var f, g
        if (j < 16) { f = (b & c) | (~b & d); g = j }
        else if (j < 32) { f = (d & b) | (~d & c); g = (5 * j + 1) % 16 }
        else if (j < 48) { f = b ^ c ^ d; g = (3 * j + 5) % 16 }
        else { f = c ^ (b | ~d); g = (7 * j) % 16 }
        var tmp = d
        d = c
        c = b
        var x = (a + f + K[j] + words[o + g]) >>> 0
        var s = R[(j >> 4) * 4 + (j % 4)]
        b = (b + ((x << s) | (x >>> (32 - s)))) >>> 0
        a = tmp
      }
      a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0
    }
    var out = new Uint8Array(16)
    ;[a0, b0, c0, d0].forEach(function (v, k) { for (var n = 0; n < 4; n++) out[k * 4 + n] = (v >>> (n * 8)) & 255 })
    return out.buffer
  }

  /** algo : MD5, SHA-1, SHA-256, SHA-384 ou SHA-512. Résout un ArrayBuffer. */
  function digest(algo, bytes) {
    if (algo === 'MD5') return Promise.resolve(md5(bytes))
    return crypto.subtle.digest(ALGOS[algo], bytes)
  }

  function hmac(algo, keyBytes, bytes) {
    return crypto.subtle
      .importKey('raw', keyBytes.length ? keyBytes : new Uint8Array(1), { name: 'HMAC', hash: ALGOS[algo] }, false, ['sign'])
      .then(function (key) { return crypto.subtle.sign('HMAC', key, bytes) })
  }

  function bcryptHash(text, cost) {
    return new Promise(function (resolve, reject) {
      root.dcodeIO.bcrypt.hash(text, cost, function (err, h) { err ? reject(err) : resolve(h) })
    })
  }

  function bcryptCompare(text, hash) {
    return new Promise(function (resolve) {
      root.dcodeIO.bcrypt.compare(text, hash, function (err, ok) { resolve(!err && ok) })
    })
  }

  /** Compare deux empreintes en ignorant la casse, les espaces et un éventuel préfixe « algo: ». */
  function same(a, b) {
    var norm = function (s) { return String(s).trim().replace(/^[a-z0-9-]+:/i, '').replace(/\s+/g, '').toLowerCase() }
    return norm(a) !== '' && norm(a) === norm(b)
  }

  root.HashLogic = {
    algos: ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'],
    digest: digest, hmac: hmac, hex: hex, base64: base64, md5: md5,
    bcryptHash: bcryptHash, bcryptCompare: bcryptCompare, same: same
  }
})(typeof window !== 'undefined' ? window : globalThis)
