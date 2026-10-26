// Factures (testées par tests/extensions/invoice.test.mjs) : calculs HT / TVA / TTC et page HTML imprimable.
;(function (root) {
  'use strict'

  /** Arrondi bancaire au centime, sans erreurs de virgule flottante. */
  function cents(v) { return Math.round((Number(v) || 0) * 100 + Number.EPSILON) / 100 }

  /** Totaux par ligne et par taux de TVA (la TVA est calculée par taux, sur le total HT du taux). */
  function totals(items, vatExempt) {
    var lines = items.map(function (it) {
      var ht = cents((Number(it.qty) || 0) * (Number(it.price) || 0))
      return { ht: ht, vat: vatExempt ? 0 : Number(it.vat) || 0 }
    })
    var byRate = {}
    lines.forEach(function (l) { byRate[l.vat] = cents((byRate[l.vat] || 0) + l.ht) })
    var rates = Object.keys(byRate).map(Number).sort(function (a, b) { return a - b }).map(function (r) {
      return { rate: r, base: byRate[r], amount: cents(byRate[r] * r / 100) }
    })
    var ht = cents(lines.reduce(function (s, l) { return s + l.ht }, 0))
    var vat = cents(rates.reduce(function (s, r) { return s + r.amount }, 0))
    return { lines: lines, rates: rates.filter(function (r) { return r.rate > 0 }), ht: ht, vat: vat, ttc: cents(ht + vat) }
  }

  /** F-2026-007 → F-2026-008 ; F-2025-012 en 2026 → F-2026-001. */
  function nextNumber(last, year) {
    var m = /^(.*?)(\d{4})-(\d+)$/.exec(String(last || ''))
    if (!m) return 'F-' + year + '-001'
    if (+m[2] !== year) return m[1] + year + '-' + '1'.padStart(m[3].length, '0')
    return m[1] + m[2] + '-' + String(+m[3] + 1).padStart(m[3].length, '0')
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] })
  }

  function money(v, currency, locale) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'EUR' }).format(v)
  }

  var L = {
    fr: { invoice: 'Facture', date: 'Date', due: 'Échéance', to: 'Facturé à', desc: 'Désignation', qty: 'Qté', unit: 'Prix unitaire HT',
      vat: 'TVA', total: 'Total HT', subtotal: 'Total HT', vatOf: 'TVA {r} %', ttc: 'Total TTC', exempt: 'TVA non applicable, article 293 B du CGI',
      payment: 'Paiement' },
    en: { invoice: 'Invoice', date: 'Date', due: 'Due date', to: 'Bill to', desc: 'Description', qty: 'Qty', unit: 'Unit price',
      vat: 'VAT', total: 'Amount', subtotal: 'Subtotal', vatOf: 'VAT {r}%', ttc: 'Total', exempt: 'VAT not applicable',
      payment: 'Payment' }
  }

  function nl(s) { return esc(s).replace(/\n/g, '<br>') }

  /** Corps HTML de la facture (aperçu) ; `page` ajoute l'enveloppe d'un document autonome. */
  function html(inv, locale, page) {
    var t = L[locale] || L.fr
    var tot = totals(inv.items, inv.vatExempt)
    var m = function (v) { return money(v, inv.currency, locale) }
    var d = function (s) { return s ? new Date(s + 'T12:00:00').toLocaleDateString(locale) : '' }
    var rows = inv.items.map(function (it, i) {
      return '<tr><td>' + nl(it.desc) + '</td><td class="n">' + esc(it.qty) + '</td><td class="n">' + m(Number(it.price) || 0) + '</td>' +
        (inv.vatExempt ? '' : '<td class="n">' + esc(it.vat) + ' %</td>') + '<td class="n">' + m(tot.lines[i].ht) + '</td></tr>'
    }).join('')
    var body =
      '<div class="inv"><header><div><h1>' + t.invoice + ' ' + esc(inv.number) + '</h1><p>' + t.date + ' : ' + d(inv.date) +
      (inv.due ? '<br>' + t.due + ' : ' + d(inv.due) : '') + '</p></div><div class="from">' + nl(inv.seller) + '</div></header>' +
      '<section class="to"><strong>' + t.to + '</strong><br>' + nl(inv.client) + '</section>' +
      '<table><thead><tr><th>' + t.desc + '</th><th class="n">' + t.qty + '</th><th class="n">' + t.unit + '</th>' +
      (inv.vatExempt ? '' : '<th class="n">' + t.vat + '</th>') + '<th class="n">' + t.total + '</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<table class="sum"><tr><td>' + t.subtotal + '</td><td class="n">' + m(tot.ht) + '</td></tr>' +
      tot.rates.map(function (r) { return '<tr><td>' + t.vatOf.replace('{r}', r.rate) + '</td><td class="n">' + m(r.amount) + '</td></tr>' }).join('') +
      '<tr class="ttc"><td>' + t.ttc + '</td><td class="n">' + m(tot.ttc) + '</td></tr></table>' +
      (inv.vatExempt ? '<p class="note">' + t.exempt + '</p>' : '') +
      (inv.payment ? '<p class="note"><strong>' + t.payment + '</strong><br>' + nl(inv.payment) + '</p>' : '') +
      (inv.notes ? '<p class="note">' + nl(inv.notes) + '</p>' : '') + '</div>'
    if (!page) return body
    return '<!doctype html>\n<html lang="' + locale + '"><head><meta charset="utf-8"><title>' + t.invoice + ' ' + esc(inv.number) + '</title><style>' +
      'body{font:14px/1.5 system-ui,sans-serif;color:#1f2328;max-width:800px;margin:32px auto;padding:0 24px}' +
      'header{display:flex;justify-content:space-between;gap:24px}h1{font-size:24px;margin:0 0 6px}.from{text-align:right}' +
      '.to{margin:28px 0}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #d0d7de;text-align:left;vertical-align:top}' +
      '.n{text-align:right;white-space:nowrap}.sum{width:auto;margin:16px 0 0 auto}.sum td{border:0;padding:4px 8px}.ttc td{font-weight:700;font-size:16px;border-top:2px solid #1f2328}' +
      '.note{color:#57606a;font-size:12.5px;margin-top:20px}@media print{body{margin:0}}' +
      '</style></head><body>' + body + '</body></html>\n'
  }

  root.InvoiceLogic = { totals: totals, nextNumber: nextNumber, html: html, money: money, cents: cents }
})(typeof window !== 'undefined' ? window : globalThis)
