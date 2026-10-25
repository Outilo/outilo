import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { LoremLogic: L } = loadLogic('lorem')

test('unités et nombre', () => {
  assert.equal(L.make({ unit: 'paragraphs', count: 4, lang: 'fr' }).length, 4)
  assert.equal(L.stats(L.make({ unit: 'words', count: 25, lang: 'en' })[0]).words, 25)
  const s = L.make({ unit: 'sentences', count: 3, lang: 'latin' })[0]
  assert.equal(s.match(/\./g).length, 3)
  assert.equal(L.make({ unit: 'list', count: 5, lang: 'latin' }).length, 5)
})

test('début classique et graine reproductible', () => {
  assert.match(L.make({ unit: 'paragraphs', count: 1, lang: 'latin', classic: true })[0], /^Lorem ipsum dolor sit amet, consectetur adipiscing elit\. /)
  const a = L.make({ unit: 'paragraphs', count: 2, lang: 'fr', seed: 'x' }).join('|')
  assert.equal(L.make({ unit: 'paragraphs', count: 2, lang: 'fr', seed: 'x' }).join('|'), a)
  assert.notEqual(L.make({ unit: 'paragraphs', count: 2, lang: 'fr', seed: 'y' }).join('|'), a)
})

test('formats', () => {
  assert.equal(L.render(['A', 'B'], 'list', 'html'), '<ul>\n  <li>A</li>\n  <li>B</li>\n</ul>')
  assert.equal(L.render(['A', 'B'], 'list', 'markdown'), '- A\n- B')
  assert.equal(L.render(['A', 'B'], 'paragraphs', 'html'), '<p>A</p>\n<p>B</p>')
  assert.equal(L.render(['A', 'B'], 'paragraphs', 'text'), 'A\n\nB')
})
