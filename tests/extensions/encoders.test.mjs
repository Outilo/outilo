import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { EncLogic: E } = loadLogic('encoders')
const enc = (c, s, o) => E.run(c, 'encode', s, o).value
const dec = (c, s) => E.run(c, 'decode', s)

test('Base64 et Base64 URL en UTF-8', () => {
  assert.equal(enc('base64', 'Été ✓'), 'w4l0w6kg4pyT')
  assert.equal(dec('base64', 'w4l0w6kg4pyT').value, 'Été ✓')
  assert.equal(enc('base64url', '??>'), 'Pz8-')
  assert.equal(dec('base64url', 'Pz8-').value, '??>')
  assert.equal(dec('base64', '***').ok, false)
})

test('URL', () => {
  assert.equal(enc('url', 'a b&c=é'), 'a%20b%26c%3D%C3%A9')
  assert.equal(dec('url', 'a+b%26c').value, 'a b&c')
  assert.equal(dec('url', '%E0%A4%A').ok, false)
})

test('Entités HTML', () => {
  assert.equal(enc('html', '<a href="x">é</a>'), '&lt;a href=&quot;x&quot;&gt;é&lt;/a&gt;')
  assert.equal(enc('html', 'é😀', { all: true }), '&#233;&#128512;')
  assert.equal(dec('html', '&lt;b&gt; &eacute; &#x1F600; &#65; &inconnu;').value, '<b> é 😀 A &inconnu;')
})

test('Hexadécimal et Unicode', () => {
  assert.equal(enc('hex', 'Aé'), '41 c3 a9')
  assert.equal(dec('hex', '0x41:c3:a9').value, 'Aé')
  assert.equal(dec('hex', 'zz').ok, false)
  assert.equal(enc('unicode', 'aé'), 'a\\u00e9')
  assert.equal(dec('unicode', '\\u00e9\\u{1F600}').value, 'é😀')
})
