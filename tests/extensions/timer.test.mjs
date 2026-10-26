import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { TimerLogic: T } = loadLogic('timer')

test('lecture des durées', () => {
  assert.equal(T.parseDuration('25'), 25 * 60000)
  assert.equal(T.parseDuration('1:30'), 90000)
  assert.equal(T.parseDuration('1:02:03'), 3723000)
  assert.equal(T.parseDuration('1h30'), 5400000)
  assert.equal(T.parseDuration('2m30s'), 150000)
  assert.equal(T.parseDuration('90s'), 90000)
  assert.equal(T.parseDuration('1:75'), null)
  assert.equal(T.parseDuration('demain'), null)
})

test('affichage', () => {
  assert.equal(T.format(3723000), '1:02:03')
  assert.equal(T.format(59001), '1:00', 'un compte à rebours arrondit à la seconde supérieure')
  assert.equal(T.format(65432, true), '1:05.4')
  assert.equal(T.format(0), '0:00')
})

test('pomodoro', () => {
  const cfg = { work: 25, short: 5, long: 15, every: 4 }
  const min = 60000
  assert.deepEqual({ ...T.pomodoro(0, cfg) }, { kind: 'work', index: 1, remaining: 25 * min })
  assert.equal(T.pomodoro(26 * min, cfg).kind, 'short')
  assert.equal(T.pomodoro(30 * min, cfg).index, 2)
  const longStart = 4 * 25 * min + 3 * 5 * min
  assert.equal(T.pomodoro(longStart + min, cfg).kind, 'long')
  assert.deepEqual({ ...T.pomodoro(longStart + 15 * min, cfg) }, { kind: 'work', index: 5, remaining: 25 * min })
})
