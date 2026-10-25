import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { ColorLogic: C } = loadLogic('colors')
const rgb = s => { const c = C.parse(s); return c && [c.r, c.g, c.b, c.a] }

test('lecture des formats', () => {
  assert.deepEqual(rgb('#f59e0b'), [245, 158, 11, 1])
  assert.deepEqual(rgb('fff'), [255, 255, 255, 1])
  assert.deepEqual(rgb('#00000080'), [0, 0, 0, 0.502])
  assert.deepEqual(rgb('rgb(10, 20, 30)'), [10, 20, 30, 1])
  assert.deepEqual(rgb('rgb(100% 0% 0% / 50%)'), [255, 0, 0, 0.5])
  assert.deepEqual(rgb('hsl(120 100% 50%)'), [0, 255, 0, 1])
  assert.deepEqual(rgb('oklch(62.8% 0.2577 29.23)'), [255, 0, 0, 1])
  assert.equal(C.parse('bleu'), null)
})

test('écriture des formats', () => {
  const f = Object.fromEntries([...C.formats(C.parse('#f59e0b'))].map(x => [x.id, x.value]))
  assert.equal(f.hex, '#f59e0b')
  assert.equal(f.rgb, 'rgb(245 158 11)')
  assert.equal(f.hsl, 'hsl(38 92% 50%)')
  assert.match(f.oklch, /^oklch\(76\.\d% 0\.1\d\d 70\.\d\)$/)
})

test('aller-retour OKLCH', () => {
  for (const hex of ['#123456', '#f59e0b', '#ffffff', '#000000', '#7c3aed']) {
    const c = C.parse(hex)
    assert.equal(C.toHex(C.oklchToRgb(C.rgbToOklch(c))), hex)
  }
})

test('contraste WCAG', () => {
  const black = C.parse('#000'), white = C.parse('#fff')
  assert.equal(Math.round(C.contrast(black, white) * 100) / 100, 21)
  const r = C.contrast(C.parse('#777777'), white)
  assert.equal(Math.round(r * 100) / 100, 4.48)
  assert.deepEqual({ ...C.wcag(r) }, { aa: false, aaLarge: true, aaa: false, aaaLarge: false })
  assert.equal(C.ink(C.parse('#f59e0b')), '#000000')
  assert.equal(C.ink(C.parse('#1e3a8a')), '#ffffff')
})

test('palettes', () => {
  const c = C.parse('#f59e0b')
  const shades = C.palette(c, 'shades')
  assert.equal(shades.length, 10)
  assert.ok(C.luminance(C.parse(shades[0])) > C.luminance(C.parse(shades[9])))
  assert.equal(C.palette(c, 'triadic').length, 3)
  assert.equal(C.palette(c, 'complementary')[0], '#f59e0b')
})
