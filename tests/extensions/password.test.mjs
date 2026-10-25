import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { PasswordLogic: P } = loadLogic('password')

test('respecte la longueur et inclut chaque jeu choisi', () => {
  for (let i = 0; i < 200; i++) {
    const { value } = P.password({ length: 8, upper: true, lower: true, digits: true, symbols: true })
    assert.equal(value.length, 8)
    assert.match(value, /[A-Z]/)
    assert.match(value, /[a-z]/)
    assert.match(value, /[0-9]/)
    assert.match(value, /[^A-Za-z0-9]/)
  }
})

test('exclut les caractères similaires et ambigus', () => {
  const { value } = P.password({ length: 128, upper: true, lower: true, digits: true, symbols: true, excludeSimilar: true, excludeAmbiguous: true })
  assert.doesNotMatch(value, /[0O1lI|{}[\]()/\\'"`~,;:.<>]/)
})

test('borne la longueur et retombe sur les minuscules sans jeu', () => {
  assert.equal(P.password({ length: 1, lower: true }).value.length, 4)
  assert.equal(P.password({ length: 999, lower: true }).value.length, 128)
  assert.match(P.password({ length: 10 }).value, /^[a-z]{10}$/)
})

test('calcule l’entropie', () => {
  assert.equal(P.password({ length: 10, digits: true }).bits, 33)
  assert.equal(P.strength(40), 0)
  assert.equal(P.strength(120), 3)
})

test('phrase de passe', () => {
  const { value, bits } = P.passphrase({ words: 4, separator: '.', capitalize: true, number: false, lang: 'en' })
  const words = value.split('.')
  assert.equal(words.length, 4)
  for (const w of words) assert.ok(P.WORDS.en.includes(w.toLowerCase()), w)
  assert.ok(bits > 25)
})

test('randomInt est uniforme (approx.)', () => {
  const counts = [0, 0, 0]
  for (let i = 0; i < 30000; i++) counts[P.randomInt(3)]++
  for (const c of counts) assert.ok(c > 9000 && c < 11000, String(counts))
})
