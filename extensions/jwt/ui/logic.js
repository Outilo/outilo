// JWT et Base64 (testés par logic.test.mjs). Rien n'est envoyé sur le réseau.
;(function (root) {
  'use strict'

  var enc = new TextEncoder()
  var dec = new TextDecoder('utf-8', { fatal: true })

  function bytesToB64(bytes) {
    var bin = ''
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
  }

  function b64ToBytes(b64) {
    var clean = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
    if (/[^A-Za-z0-9+/=]/.test(clean)) throw new Error('base64')
    while (clean.length % 4) clean += '='
    var bin = atob(clean)
    var out = new Uint8Array(bin.length)
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }

  function encodeBase64(text, urlSafe) {
    var b64 = bytesToB64(enc.encode(text))
    return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64
  }

  /** Lève une erreur si l'entrée n'est pas du Base64 contenant de l'UTF-8 valide. */
  function decodeBase64(text) {
    return dec.decode(b64ToBytes(text.trim()))
  }

  function decodeJwt(token) {
    var parts = token.trim().split('.')
    if (parts.length !== 3) throw new Error('parts')
    var header, payload
    try {
      header = JSON.parse(decodeBase64(parts[0]))
      payload = JSON.parse(decodeBase64(parts[1]))
    } catch (e) {
      throw new Error('json')
    }
    return { header: header, payload: payload, signature: parts[2], signingInput: parts[0] + '.' + parts[1] }
  }

  /** Statut temporel : 'valid' | 'expired' | 'notYet' | 'none' */
  function timeStatus(payload, nowSec) {
    if (typeof payload.nbf === 'number' && nowSec < payload.nbf) return 'notYet'
    if (typeof payload.exp === 'number') return nowSec >= payload.exp ? 'expired' : 'valid'
    return 'none'
  }

  var HMAC = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' }

  /** Vérifie une signature HMAC. Résout true/false, rejette si l'algorithme n'est pas pris en charge. */
  async function verifyHmac(token, secret) {
    var jwt = decodeJwt(token)
    var hash = HMAC[jwt.header.alg]
    if (!hash) throw new Error('alg')
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: hash }, false, ['verify'])
    return crypto.subtle.verify('HMAC', key, b64ToBytes(jwt.signature), enc.encode(jwt.signingInput))
  }

  /** Signe un JWT HMAC (utile pour fabriquer des jetons de test). */
  async function signHmac(header, payload, secret) {
    var hash = HMAC[header.alg]
    if (!hash) throw new Error('alg')
    var input = encodeBase64(JSON.stringify(header), true) + '.' + encodeBase64(JSON.stringify(payload), true)
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: hash }, false, ['sign'])
    var sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(input)))
    return input + '.' + bytesToB64(sig).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  root.JwtLogic = {
    encodeBase64: encodeBase64,
    decodeBase64: decodeBase64,
    decodeJwt: decodeJwt,
    timeStatus: timeStatus,
    verifyHmac: verifyHmac,
    signHmac: signHmac
  }
})(typeof window !== 'undefined' ? window : globalThis)
