import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { UuidLogic: U } = loadLogic('uuid')

test('UUID v4 bien formé et unique', () => {
  const seen = new Set()
  for (let i = 0; i < 2000; i++) {
    const id = U.v4()
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    seen.add(id)
  }
  assert.equal(seen.size, 2000)
})

test('UUID v7 encode l’horodatage et se trie dans le temps', () => {
  const t = Date.UTC(2026, 9, 25, 12, 0, 0)
  const a = U.v7(t)
  const b = U.v7(t + 1)
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(U.timestampOf(a), t)
  assert.ok(a < b)
})

test('ULID : 26 caractères Crockford et horodatage', () => {
  const t = 1469918176385
  const id = U.ulid(t)
  assert.match(id, /^[0-9A-HJKMNP-TV-Z]{26}$/)
  assert.equal(id.slice(0, 10), '01ARYZ6S41')
  assert.equal(U.timestampOf(id), t)
})

test('NanoID et options', () => {
  assert.match(U.nanoid(), /^[A-Za-z0-9_-]{21}$/)
  assert.equal(U.nanoid(10).length, 10)
  assert.match(U.make('v4', { upper: true, noHyphens: true }), /^[0-9A-F]{32}$/)
  assert.equal(U.timestampOf(U.v4()), null)
})
