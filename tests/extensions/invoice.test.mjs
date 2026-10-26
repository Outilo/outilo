import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { InvoiceLogic: I } = loadLogic('invoice')
const plain = v => JSON.parse(JSON.stringify(v))

test('totaux HT, TVA par taux, TTC', () => {
  const t = plain(I.totals([
    { desc: 'Site vitrine', qty: 1, price: 1200, vat: 20 },
    { desc: 'Maintenance', qty: 3, price: 33.33, vat: 20 },
    { desc: 'Livre', qty: 2, price: 9.99, vat: 5.5 }
  ]))
  assert.equal(t.ht, 1319.97)
  assert.deepEqual(t.rates, [{ rate: 5.5, base: 19.98, amount: 1.1 }, { rate: 20, base: 1299.99, amount: 260 }])
  assert.equal(t.vat, 261.1)
  assert.equal(t.ttc, 1581.07)
  assert.equal(I.totals([{ qty: 2, price: 50, vat: 20 }], true).ttc, 100, 'franchise de TVA')
  assert.equal(I.cents(0.1 + 0.2), 0.3)
})

test('numérotation', () => {
  assert.equal(I.nextNumber('F-2026-007', 2026), 'F-2026-008')
  assert.equal(I.nextNumber('F-2025-012', 2026), 'F-2026-001')
  assert.equal(I.nextNumber('', 2026), 'F-2026-001')
  assert.equal(I.nextNumber('DEV2026-0099', 2026), 'DEV2026-0100')
})

test('page HTML échappée', () => {
  const inv = { number: 'F-1', date: '2026-10-26', seller: 'Moi <script>', client: 'Client\nLyon', currency: 'EUR', items: [{ desc: 'A & B', qty: 1, price: 10, vat: 20 }], vatExempt: false }
  const page = I.html(inv, 'fr', true)
  assert.match(page, /^<!doctype html>/)
  assert.doesNotMatch(page, /<script>/)
  assert.match(page, /A &amp; B/)
  assert.match(page, /Client<br>Lyon/)
  assert.match(page, /12,00\s€/)
  assert.match(I.html({ ...inv, vatExempt: true }, 'fr'), /293 B/)
})
