import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { HashLogic: H } = loadLogic('hash', ['vendor/bcrypt.min.js'])
const utf8 = s => new TextEncoder().encode(s)
const hexOf = async (algo, s) => H.hex(await H.digest(algo, utf8(s)))

test('MD5 (vecteurs RFC 1321)', async () => {
  assert.equal(await hexOf('MD5', ''), 'd41d8cd98f00b204e9800998ecf8427e')
  assert.equal(await hexOf('MD5', 'abc'), '900150983cd24fb0d6963f7d28e17f72')
  assert.equal(await hexOf('MD5', 'a'.repeat(1000)), 'cabe45dcc9ae5b66ba86600cca6b8ba8')
})

test('SHA et HMAC', async () => {
  assert.equal(await hexOf('SHA-1', 'abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d')
  assert.equal(await hexOf('SHA-256', 'abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  const mac = await H.hmac('SHA-256', utf8('key'), utf8('The quick brown fox jumps over the lazy dog'))
  assert.equal(H.hex(mac), 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8')
  assert.equal(H.base64(await H.digest('SHA-256', utf8(''))), '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=')
})

test('comparaison tolérante', () => {
  assert.ok(H.same('SHA256: BA78 16bf', 'ba7816bf'))
  assert.ok(!H.same('', ''))
  assert.ok(!H.same('abc', 'abd'))
})

test('bcrypt génère puis vérifie', async () => {
  const hash = await H.bcryptHash('motdepasse', 4)
  assert.match(hash, /^\$2a\$04\$/)
  assert.equal(await H.bcryptCompare('motdepasse', hash), true)
  assert.equal(await H.bcryptCompare('autre', hash), false)
})
