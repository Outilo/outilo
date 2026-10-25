import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { CleanLogic: C } = loadLogic('cleaner')

const scan = [
  { id: 'temp', group: 'system', bytes: 1000, files: 10, found: true },
  { id: 'recycle-bin', group: 'system', bytes: 5000, files: 3, found: true },
  { id: 'chrome', group: 'browser', bytes: 0, files: 0, found: true },
  { id: 'edge', group: 'browser', bytes: 2000, files: 4, found: true },
  { id: 'firefox', group: 'browser', bytes: 0, files: 0, found: false },
  { id: 'npm', group: 'dev', bytes: 9000, files: 90, found: true }
]

test('sélection par défaut prudente', () => {
  assert.deepEqual([...C.defaults(scan)], ['temp', 'edge'], 'ni corbeille, ni caches de développement, ni cibles vides')
})

test('totaux et groupes', () => {
  assert.deepEqual({ ...C.total(scan, ['temp', 'npm']) }, { bytes: 10000, files: 100 })
  const g = C.grouped(scan)
  assert.deepEqual([...g].map(x => x.id), ['system', 'browser', 'dev'])
  assert.equal(g[1].items.length, 2, 'Firefox absent : masqué')
  assert.equal(C.bytes(3 * 1024 * 1024 * 1024, 'fr'), '3.0 Go')
})
