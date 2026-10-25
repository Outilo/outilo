// Identifiants uniques (testés par logic.test.mjs).
;(function (root) {
  'use strict'

  var CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  var NANO = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

  function bytes(n) {
    var b = new Uint8Array(n)
    crypto.getRandomValues(b)
    return b
  }

  function hex(b) {
    var s = ''
    for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16)
    return s.slice(0, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16) + '-' + s.slice(16, 20) + '-' + s.slice(20)
  }

  function v4() {
    var b = bytes(16)
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    return hex(b)
  }

  /** UUID v7 (RFC 9562) : 48 bits d'horodatage en millisecondes, triables dans le temps. */
  function v7(now) {
    var ms = now == null ? Date.now() : now
    var b = bytes(16)
    for (var i = 5; i >= 0; i--) {
      b[i] = ms % 256
      ms = Math.floor(ms / 256)
    }
    b[6] = (b[6] & 0x0f) | 0x70
    b[8] = (b[8] & 0x3f) | 0x80
    return hex(b)
  }

  function ulid(now) {
    var ms = now == null ? Date.now() : now
    var time = ''
    for (var i = 0; i < 10; i++) {
      time = CROCKFORD[ms % 32] + time
      ms = Math.floor(ms / 32)
    }
    // 80 bits aléatoires = 16 caractères de 5 bits ; 32 divise 256, donc pas de biais
    var rand = ''
    var b = bytes(16)
    for (var j = 0; j < 16; j++) rand += CROCKFORD[b[j] % 32]
    return time + rand
  }

  function nanoid(size) {
    var n = size || 21
    var b = bytes(n)
    var id = ''
    for (var i = 0; i < n; i++) id += NANO[b[i] & 63]
    return id
  }

  /** Horodatage (ms) d'un UUID v7 ou d'un ULID, sinon null. */
  function timestampOf(id) {
    var s = id.trim()
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
      return parseInt(s.replace(/-/g, '').slice(0, 12), 16)
    }
    if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(s)) {
      var ms = 0
      for (var i = 0; i < 10; i++) ms = ms * 32 + CROCKFORD.indexOf(s[i].toUpperCase())
      return ms
    }
    return null
  }

  function make(kind, opts) {
    var id = kind === 'v7' ? v7() : kind === 'ulid' ? ulid() : kind === 'nanoid' ? nanoid(opts.size) : v4()
    if (kind === 'v4' || kind === 'v7') {
      if (opts.noHyphens) id = id.replace(/-/g, '')
      if (opts.upper) id = id.toUpperCase()
    }
    return id
  }

  root.UuidLogic = { v4: v4, v7: v7, ulid: ulid, nanoid: nanoid, make: make, timestampOf: timestampOf }
})(typeof window !== 'undefined' ? window : globalThis)
