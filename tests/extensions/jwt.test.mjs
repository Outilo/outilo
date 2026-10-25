import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { JwtLogic: J } = loadLogic('jwt')

// Jeton d'exemple de jwt.io (secret : « your-256-bit-secret »)
const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

test('décode un JWT', () => {
  const jwt = J.decodeJwt(SAMPLE)
  assert.equal(jwt.header.alg, 'HS256')
  assert.equal(jwt.payload.name, 'John Doe')
})

test('vérifie la signature HMAC', async () => {
  assert.equal(await J.verifyHmac(SAMPLE, 'your-256-bit-secret'), true)
  assert.equal(await J.verifyHmac(SAMPLE, 'mauvais'), false)
})

test('signe puis vérifie (HS512, UTF-8)', async () => {
  const token = await J.signHmac({ alg: 'HS512', typ: 'JWT' }, { nom: 'Éloïse', exp: 2000000000 }, 's3cret')
  assert.equal(J.decodeJwt(token).payload.nom, 'Éloïse')
  assert.equal(await J.verifyHmac(token, 's3cret'), true)
})

test('rejette les jetons invalides et les algorithmes non HMAC', async () => {
  assert.throws(() => J.decodeJwt('abc'), /parts/)
  assert.throws(() => J.decodeJwt('a.b.c'), /json/)
  const none = J.encodeBase64('{"alg":"RS256"}', true) + '.' + J.encodeBase64('{}', true) + '.x'
  await assert.rejects(J.verifyHmac(none, 'k'), /alg/)
})

test('statut temporel', () => {
  assert.equal(J.timeStatus({ exp: 100 }, 99), 'valid')
  assert.equal(J.timeStatus({ exp: 100 }, 100), 'expired')
  assert.equal(J.timeStatus({ nbf: 50, exp: 100 }, 10), 'notYet')
  assert.equal(J.timeStatus({}, 10), 'none')
})

test('Base64 UTF-8 aller-retour, standard et URL', () => {
  const text = 'Outilo ✓ çà & ?/+'
  assert.equal(J.decodeBase64(J.encodeBase64(text)), text)
  const url = J.encodeBase64(text, true)
  assert.doesNotMatch(url, /[+/=]/)
  assert.equal(J.decodeBase64(url), text)
  assert.throws(() => J.decodeBase64('###'))
})
