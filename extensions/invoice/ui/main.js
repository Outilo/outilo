/* global outilo, InvoiceLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Factures', subtitle: 'Créez une facture, exportez-la en page HTML puis imprimez-la en PDF depuis votre navigateur.',
    number: 'Numéro', currency: 'Devise', date: 'Date', due: 'Échéance', seller: 'Émetteur', client: 'Client',
    sellerHint: 'Votre nom ou société\nAdresse\nSIRET, n° de TVA', clientHint: 'Nom du client\nAdresse',
    desc: 'Désignation', qty: 'Qté', price: 'Prix HT', vat: 'TVA %', add: 'Ajouter une ligne', exempt: 'Franchise de TVA (micro-entreprise)',
    payment: 'Paiement', paymentHint: 'Virement : IBAN…\nÀ régler sous 30 jours', notes: 'Mentions',
    notesHint: 'Pénalités de retard : 3 fois le taux d’intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €.',
    newInv: 'Nouvelle facture', save: 'Enregistrer la page HTML', saved: 'Facture enregistrée : ouvrez-la puis Ctrl+P pour un PDF',
    remove: 'Retirer', item: 'Prestation'
  },
  en: {
    title: 'Invoices', subtitle: 'Create an invoice, export it as an HTML page, then print it to PDF from your browser.',
    number: 'Number', currency: 'Currency', date: 'Date', due: 'Due date', seller: 'From', client: 'Client',
    sellerHint: 'Your name or company\nAddress\nCompany / VAT number', clientHint: 'Client name\nAddress',
    desc: 'Description', qty: 'Qty', price: 'Unit price', vat: 'VAT %', add: 'Add a line', exempt: 'No VAT',
    payment: 'Payment', paymentHint: 'Bank transfer: IBAN…\nDue within 30 days', notes: 'Notes',
    notesHint: 'Late payment fees may apply.',
    newInv: 'New invoice', save: 'Save HTML page', saved: 'Invoice saved: open it then Ctrl+P for a PDF',
    remove: 'Remove', item: 'Service'
  }
}

var $ = function (s) { return document.querySelector(s) }
var FIELDS = ['number', 'currency', 'date', 'due', 'seller', 'client', 'payment', 'notes']
var items = []
var saveTimer

function today(offsetDays) {
  var d = new Date(Date.now() + (offsetDays || 0) * 86400000)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function current() {
  var inv = { items: items, vatExempt: $('#exempt').checked }
  FIELDS.forEach(function (f) { inv[f] = $('#' + f).value })
  return inv
}

function renderItems() {
  var tbody = $('#items')
  tbody.innerHTML = ''
  items.forEach(function (it, i) {
    var tr = document.createElement('tr')
    ;[['desc', 'text', ''], ['qty', 'number', 'num'], ['price', 'number', 'num'], ['vat', 'number', 'num']].forEach(function (f) {
      var td = document.createElement('td')
      var input = document.createElement('input')
      input.className = 'o-input ' + f[2]
      input.type = f[1]
      if (f[1] === 'number') input.step = 'any'
      input.value = it[f[0]]
      input.disabled = f[0] === 'vat' && $('#exempt').checked
      input.addEventListener('input', function () { it[f[0]] = f[1] === 'number' ? input.value : input.value; update() })
      td.appendChild(input)
      tr.appendChild(td)
    })
    var td = document.createElement('td')
    var b = document.createElement('button')
    b.className = 'o-btn o-btn--sm'
    b.textContent = '×'
    b.title = outilo.t('remove')
    b.addEventListener('click', function () { items.splice(i, 1); renderItems(); update() })
    td.appendChild(b)
    tr.appendChild(td)
    tbody.appendChild(tr)
  })
}

function update() {
  // Aperçu : tout le texte saisi est échappé par InvoiceLogic.html
  $('#preview').innerHTML = InvoiceLogic.html(current(), outilo.locale, false)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(function () { outilo.storage.set('draft', current()).catch(function () {}) }, 500)
}

function fill(inv) {
  FIELDS.forEach(function (f) { $('#' + f).value = inv[f] || '' })
  $('#exempt').checked = !!inv.vatExempt
  items = inv.items && inv.items.length ? inv.items : [{ desc: outilo.t('item'), qty: 1, price: 0, vat: 20 }]
  renderItems()
  update()
}

FIELDS.forEach(function (f) { $('#' + f).addEventListener('input', update) })
$('#exempt').addEventListener('change', function () { renderItems(); update() })
$('#add').addEventListener('click', function () { items.push({ desc: '', qty: 1, price: 0, vat: items.length ? items[items.length - 1].vat : 20 }); renderItems(); update() })
$('#newInv').addEventListener('click', function () {
  var inv = current()
  fill({ number: InvoiceLogic.nextNumber(inv.number, new Date().getFullYear()), currency: inv.currency, date: today(), due: today(30),
    seller: inv.seller, payment: inv.payment, notes: inv.notes, vatExempt: inv.vatExempt, client: '', items: [] })
})
$('#save').addEventListener('click', async function () {
  var inv = current()
  if (await outilo.files.save((inv.number || 'facture') + '.html', InvoiceLogic.html(inv, outilo.locale, true))) {
    outilo.toast(outilo.t('saved'), 'success')
    outilo.storage.set('last', inv.number).catch(function () {})
  }
})

outilo.onLocale(update)
outilo.ready.then(async function () {
  var draft = null
  try { draft = await outilo.storage.get('draft') } catch (e) { /* aucun stockage */ }
  fill(draft || { number: InvoiceLogic.nextNumber('', new Date().getFullYear()), currency: 'EUR', date: today(), due: today(30), items: [] })
})
