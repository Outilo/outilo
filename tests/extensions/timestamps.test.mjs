import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { TsLogic: T } = loadLogic('timestamps')
const iso = d => d && d.toISOString()

test('détection secondes / millisecondes / micro / nano', () => {
  assert.equal(iso(T.parse('1761400000')), '2025-10-25T13:46:40.000Z')
  assert.equal(iso(T.parse('1761400000123')), '2025-10-25T13:46:40.123Z')
  assert.equal(iso(T.parse('1761400000123456')), '2025-10-25T13:46:40.123Z')
  assert.equal(iso(T.parse('1761400000123456789')), '2025-10-25T13:46:40.123Z')
  assert.equal(iso(T.parse('2026-10-25T18:00:00+02:00')), '2026-10-25T16:00:00.000Z')
  assert.equal(iso(T.parse('Sun, 25 Oct 2026 16:00:00 GMT')), '2026-10-25T16:00:00.000Z')
  assert.equal(iso(T.parse('now', Date.UTC(2026, 0, 1))), '2026-01-01T00:00:00.000Z')
  assert.equal(T.parse('pas une date'), null)
})

test('semaine ISO et jour de l’année', () => {
  assert.deepEqual({ ...T.isoWeek(new Date(Date.UTC(2021, 0, 3))) }, { year: 2020, week: 53 })
  assert.deepEqual({ ...T.isoWeek(new Date(Date.UTC(2026, 9, 25))) }, { year: 2026, week: 43 })
  assert.equal(T.dayOfYear(new Date(Date.UTC(2024, 11, 31))), 366)
})

test('fuseaux et formats', () => {
  const d = new Date(Date.UTC(2026, 6, 1, 12, 0, 0))
  assert.equal(T.offset(d, 'Europe/Paris'), '+02:00')
  assert.equal(T.offset(d, 'UTC'), '+00:00')
  assert.equal(T.isoInZone(d, 'Asia/Kolkata'), '2026-07-01T17:30:00+05:30')
  assert.equal(T.relative(new Date(0), 3600 * 1000 * 3, 'fr'), 'il y a 3 heures')
  const f = T.formats(d, d.getTime(), 'en', 'UTC')
  assert.equal(f.find(x => x.id === 'unix').value, String(d.getTime() / 1000))
  assert.equal(f.find(x => x.id === 'rfc').value, 'Wed, 01 Jul 2026 12:00:00 GMT')
})

test('formatage par motif et code généré', () => {
  const d = new Date(2026, 9, 5, 14, 7, 9, 42)
  assert.equal(T.formatPattern(d, 'YYYY-MM-DD HH:mm:ss.SSS', 'fr'), '2026-10-05 14:07:09.042')
  assert.equal(T.formatPattern(d, 'dddd D MMMM YYYY [à] H[h]mm', 'fr'), 'lundi 5 octobre 2026 à 14h07')
  assert.equal(T.formatPattern(d, 'hh:mm A', 'en'), '02:07 PM')
  const code = T.codeFor('DD/MM/YYYY [à] HH:mm')
  const formatDate = new Function(code + '\nreturn formatDate')()
  assert.equal(formatDate(d), '05/10/2026 à 14:07')
})
