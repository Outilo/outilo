import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { ImageLogic: I } = loadLogic('image')
const size = (w, h, o) => ({ ...I.targetSize(w, h, o) })

test('redimensionnement', () => {
  assert.deepEqual(size(4000, 3000, {}), { width: 4000, height: 3000 })
  assert.deepEqual(size(4000, 3000, { width: 1000 }), { width: 1000, height: 750 })
  assert.deepEqual(size(4000, 3000, { height: 300 }), { width: 400, height: 300 })
  assert.deepEqual(size(4000, 3000, { width: 1000, height: 1000 }), { width: 1000, height: 750 }, 'contenu dans la boîte')
  assert.deepEqual(size(4000, 3000, { width: 100, height: 100, keep: false }), { width: 100, height: 100 })
  assert.deepEqual(size(4000, 3000, { rotate: 90, width: 300 }), { width: 300, height: 400 })
})

test('noms et tailles', () => {
  assert.equal(I.outName('photo.vacances.HEIC', 'webp'), 'photo.vacances.webp')
  assert.equal(I.outName('scan', 'jpeg'), 'scan.jpg')
  assert.equal(I.base64Size(btoa('abcd')), 4)
  assert.equal(I.base64Size(btoa('abcde')), 5)
  assert.equal(I.bytes(1536, 'fr'), '1.5 Ko')
})
