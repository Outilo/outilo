import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { NetLogic: N } = loadLogic('network')

test('hôtes valides', () => {
  for (const h of ['exemple.com', 'localhost', '8.8.8.8', '2001:db8::1', 'a-b.c.fr.']) assert.ok(N.validHost(h), h)
  for (const h of ['', 'a b', '-x.com', 'exemple..com', 'http://x']) assert.ok(!N.validHost(h), h)
})

test('cible hôte / port', () => {
  assert.deepEqual({ ...N.target('exemple.com', 80) }, { host: 'exemple.com', port: 80 })
  assert.deepEqual({ ...N.target('localhost:3000', 80) }, { host: 'localhost', port: 3000 })
  assert.deepEqual({ ...N.target('https://exemple.com/page', 80) }, { host: 'exemple.com', port: 443 })
  assert.deepEqual({ ...N.target('[::1]:8080', 80) }, { host: '::1', port: 8080 })
  assert.deepEqual({ ...N.target('2001:db8::1', 22) }, { host: '2001:db8::1', port: 22 })
})

test('statistiques de ping', () => {
  const s = N.pingStats([{ ok: true, ms: 10 }, { ok: false }, { ok: true, ms: 30 }, { ok: true, ms: 20 }])
  assert.deepEqual({ ...s }, { sent: 4, received: 3, loss: 25, min: 10, max: 30, avg: 20 })
  assert.equal(N.pingStats([{ ok: false }]).avg, null)
  assert.ok(N.isPrivate('192.168.1.2') && N.isPrivate('fe80::1') && !N.isPrivate('8.8.8.8'))
})
