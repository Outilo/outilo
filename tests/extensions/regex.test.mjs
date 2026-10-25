import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { RegexLogic: R } = loadLogic('regex')

test('compilation et erreurs', () => {
  assert.ok(R.compile('\\d+', 'g').ok)
  const bad = R.compile('(abc', '')
  assert.equal(bad.ok, false)
  assert.match(bad.error, /Unterminated group|missing \)/i)
})

test('correspondances, groupes nommés et motif vide', () => {
  const re = R.compile('(?<a>\\d)(\\w)?', 'g').re
  const list = R.matches(re, '1x 2')
  assert.equal(list.length, 2)
  assert.equal(list[0].named.a, '1')
  assert.equal(list[1].groups[1], undefined)
  assert.equal(R.matches(R.compile('\\d', '').re, 'a1b2').length, 1, 'sans g : une seule')
  assert.equal(R.matches(R.compile('', 'g').re, 'abc').length, 4, 'pas de boucle infinie')
})

test('segments pour le surlignage', () => {
  const re = R.compile('b+', 'g').re
  const seg = R.segments('abbcb', R.matches(re, 'abbcb'))
  assert.deepEqual(JSON.parse(JSON.stringify(seg)), [
    { text: 'a', hit: -1 }, { text: 'bb', hit: 0 }, { text: 'c', hit: -1 }, { text: 'b', hit: 1 }
  ])
})

test('bibliothèque : chaque exemple compile et trouve au moins une correspondance', () => {
  for (const e of R.LIBRARY) {
    const c = R.compile(e.pattern, e.flags)
    assert.ok(c.ok, e.id)
    assert.ok(R.matches(c.re, e.sample).length > 0, e.id)
  }
  const ip = R.LIBRARY.find(e => e.id === 'ipv4')
  assert.deepEqual([...R.matches(R.compile(ip.pattern, ip.flags).re, ip.sample).map(m => m.match)], ['192.168.1.10', '8.8.8.8'])
  assert.equal(R.replace(R.compile('(\\d{4})-(\\d{2})', 'g').re, '2026-10', '$2/$1'), '10/2026')
})
