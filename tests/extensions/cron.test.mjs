import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { CronLogic: C } = loadLogic('cron')
const p = e => C.parse(e)

test('analyse des champs et erreurs', () => {
  assert.deepEqual([...p('*/15 9-17 * * MON-FRI').minute.values], [0, 15, 30, 45])
  assert.deepEqual([...p('0 0 * * 7').dow.values], [0], '7 = dimanche')
  assert.deepEqual([...p('0 0 1 JAN,jul *').month.values], [1, 7])
  assert.equal(p('@daily').macro, '@daily')
  assert.equal(p('* * *').ok, false)
  const bad = p('61 * * * *')
  assert.equal(bad.ok, false)
  assert.equal(bad.field, 'minute')
  assert.equal(p('5-2 * * * *').ok, false)
})

test('prochaines exécutions', () => {
  const from = new Date(2026, 9, 25, 10, 7) // dimanche 25 octobre 2026, 10:07
  const runs = C.next(p('*/15 9-17 * * MON-FRI'), from, 3)
  assert.deepEqual([...runs].map(d => [d.getDate(), d.getHours(), d.getMinutes()]), [[26, 9, 0], [26, 9, 15], [26, 9, 30]])
  const leap = C.next(p('0 12 29 2 *'), from, 1)[0]
  assert.equal(leap.getFullYear(), 2028)
  // Jour du mois OU jour de semaine quand les deux sont restreints
  const both = C.next(p('0 0 1 * MON'), from, 2)
  assert.deepEqual([...both].map(d => d.getDate()), [26, 1])
})

test('description lisible', () => {
  assert.equal(C.describe(p('*/5 * * * *'), 'fr'), 'Toutes les 5 minutes, tous les jours')
  assert.equal(C.describe(p('*/15 9-17 * * 1-5'), 'fr'), 'Toutes les 15 minutes, de 09:00 à 17:45, du lundi au vendredi')
  assert.equal(C.describe(p('30 8 * * 1-5'), 'fr'), 'À 08:30, du lundi au vendredi')
  assert.equal(C.describe(p('0 9,18 * * *'), 'en'), 'At 09:00 and 18:00, every day')
  assert.equal(C.describe(p('0 0 1 1 *'), 'fr'), 'À 00:00, le 1er du mois, en janvier')
  assert.equal(C.describe(p('15 */2 * * 0,6'), 'en'), 'Every 2 hours, at minute 15, on Sunday and Saturday')
})
