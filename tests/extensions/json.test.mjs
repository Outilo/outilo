import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { JsonLogic: J } = loadLogic('json', ['vendor/js-yaml.min.js'])
// Les objets viennent d'un autre contexte vm : on compare leur forme JSON
const plain = v => JSON.parse(JSON.stringify(v))

test('analyse et position de l’erreur', () => {
  assert.deepEqual(plain(J.parse('{"a":1}').value), { a: 1 })
  const err = J.parse('{\n  "a": 1,\n  "b": }')
  assert.equal(err.ok, false)
  assert.equal(err.line, 3)
  assert.ok(err.col > 1)
})

test('formatage, tri des clés et minification', () => {
  const v = { b: 1, a: { d: [3, { z: 1, y: 2 }], c: true } }
  assert.equal(J.format(v, 2, true), '{\n  "a": {\n    "c": true,\n    "d": [\n      3,\n      {\n        "y": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}')
  assert.equal(J.format({ a: 1 }, 'tab'), '{\n\t"a": 1\n}')
  assert.equal(J.minify(v), '{"b":1,"a":{"d":[3,{"z":1,"y":2}],"c":true}}')
})

test('JSON ⇄ YAML aller-retour', () => {
  const v = { nom: 'Outilo', tags: ['a', 'b'], n: 3, ok: false, rien: null }
  const yaml = J.toYaml(v)
  assert.match(yaml, /nom: Outilo/)
  assert.deepEqual(plain(J.fromYaml(yaml).value), v)
  const bad = J.fromYaml('a: [1, 2')
  assert.equal(bad.ok, false)
})

test('statistiques', () => {
  assert.deepEqual(plain(J.stats({ a: [1, 2], b: { c: 1 } })), { nodes: 6, depth: 2 })
})
