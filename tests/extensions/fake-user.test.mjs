import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { FakeUserLogic: F } = loadLogic('fake-user')
const now = new Date('2026-10-25T12:00:00Z')

test('même graine, mêmes utilisateurs', () => {
  const a = F.generate({ count: 20, lang: 'fr', seed: 'demo', now })
  const b = F.generate({ count: 20, lang: 'fr', seed: 'demo', now })
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)))
  const c = F.generate({ count: 20, lang: 'fr', seed: 'autre', now })
  assert.notDeepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(c)))
})

test('données réservées à la fiction', () => {
  for (const lang of ['fr', 'en']) {
    for (const u of F.generate({ count: 300, lang, now })) {
      assert.match(u.email, /@example\.(com|org|net)$/)
      assert.match(u.phone, lang === 'fr' ? /^06 39 98 \d\d \d\d$/ : /^\(\d{3}\) 555-01\d\d$/)
      assert.match(u.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      const age = 2026 - Number(u.birthdate.slice(0, 4))
      assert.ok(age >= 18 && age <= 68, String(age))
    }
  }
})

test('borne le nombre', () => {
  assert.equal(F.generate({ count: 0, lang: 'fr' }).length, 1)
  assert.equal(F.generate({ count: 20000, lang: 'en' }).length, 10000)
})

test('export CSV échappe les valeurs', () => {
  const csv = F.toCSV([{ firstName: 'A,b', lastName: 'say "hi"' }], ['firstName', 'lastName'])
  assert.equal(csv, 'firstName,lastName\r\n"A,b","say ""hi"""\r\n')
})

test('export SQL échappe les apostrophes et valide le nom de table', () => {
  const sql = F.toSQL([{ lastName: "O'Neil", firstName: 'Ana' }], ['firstName', 'lastName'], 'users; DROP TABLE x')
  assert.equal(sql, "INSERT INTO users (first_name, last_name) VALUES\n  ('Ana', 'O''Neil');\n")
})

test('export JSON ne garde que les champs choisis', () => {
  const [u] = JSON.parse(F.toJSON(F.generate({ count: 1, lang: 'fr', seed: 'x', now }), ['email']))
  assert.deepEqual(Object.keys(u), ['email'])
})
