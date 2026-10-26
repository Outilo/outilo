import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { loadLogic } from './helper.mjs'

const ctx = loadLogic('jsrun')
const { JsRunLogic: J } = ctx
// Valeurs créées dans le même contexte que la logique (instanceof correct)
const make = src => vm.runInContext(src, ctx)

test('mise en forme des valeurs', () => {
  assert.equal(J.inspect('texte'), 'texte')
  assert.equal(J.inspect(make('({ a: 1, b: "x", "c d": [1, 2], f() {} })')), '{ a: 1, b: "x", "c d": [1, 2], f: [Function f] }')
  assert.equal(J.inspect(make('new Map([["k", 1]])')), 'Map(1) {"k" => 1}')
  assert.equal(J.inspect(make('new Set([1, 2])')), 'Set(2) {1, 2}')
  assert.equal(J.inspect(make('new TypeError("oups")')), 'TypeError: oups')
  assert.equal(J.inspect(undefined), 'undefined')
  assert.equal(J.inspect(make('10n')), '10n')
  assert.equal(J.inspect(-0), '-0')
  const circ = make('var o = { nom: "o" }; o.moi = o; o')
  assert.equal(J.inspect(circ), '{ nom: "o", moi: [Circulaire] }')
  assert.equal(J.inspect(make('({ a: { b: { c: { d: { e: 1 } } } } })')), '{ a: { b: { c: { d: [Object] } } } }')
  assert.equal(J.format(['a', 1, true]), 'a 1 true')
})

test('enveloppe d’exécution', () => {
  const w = J.wrap('return 1 + 1', 7)
  assert.match(w, /^\(async \(\) => \{\nreturn 1 \+ 1\n\}\)\(\)/)
  assert.match(w, /__jsrunDone\(7, v, null\)/)
})
