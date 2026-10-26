import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { SqlLogic: S } = loadLogic('sql')

test('découpage des instructions', () => {
  assert.deepEqual([...S.split("SELECT 'a;b'; -- commentaire ; \nSELECT \"x;y\" /* ; */ FROM t;;")], ["SELECT 'a;b'", 'SELECT "x;y"  FROM t'])
  assert.deepEqual([...S.split("INSERT INTO t VALUES ('l''été;')")], ["INSERT INTO t VALUES ('l''été;')"])
  const trig = 'CREATE TRIGGER tr AFTER INSERT ON t BEGIN UPDATE t SET a = 1; DELETE FROM u; END; SELECT 1'
  assert.equal(S.split(trig).length, 2)
  assert.equal(S.split(S.SAMPLE).length, 5)
})

test('cellules et CSV', () => {
  assert.equal(S.cell(null), '')
  assert.equal(S.cell({ $blob: 'AQID' }), '[BLOB 3 o]')
  assert.equal(S.toCsv({ columns: ['nom', 'note'], rows: [['Dupont, Jean', 'dit "oui"'], ['A', null]] }), 'nom,note\n"Dupont, Jean","dit ""oui"""\nA,')
})
