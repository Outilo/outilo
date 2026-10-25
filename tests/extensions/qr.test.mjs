import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { QrLogic: Q } = loadLogic('qr', ['vendor/qrcode.js'])

test('contenus Wi-Fi et e-mail', () => {
  assert.equal(Q.wifi({ ssid: 'Maison;5G', password: 'a:b"c', security: 'WPA' }), 'WIFI:T:WPA;S:Maison\\;5G;P:a\\:b\\"c;;')
  assert.equal(Q.wifi({ ssid: 'Invités', security: 'nopass', hidden: true }), 'WIFI:T:nopass;S:Invités;H:true;;')
  assert.equal(Q.email({ to: 'a@exemple.com', subject: 'Bonjour à tous' }), 'mailto:a@exemple.com?subject=Bonjour%20%C3%A0%20tous')
})

test('matrice : taille selon le contenu et le niveau de correction', () => {
  const small = Q.matrix('https://exemple.com', 'L')
  assert.equal(small.size, 25, 'version 2')
  assert.ok(Q.matrix('https://exemple.com', 'H').size > small.size)
  // Motifs de repérage aux trois coins
  for (const [r, c] of [[0, 0], [0, small.size - 1], [small.size - 1, 0]]) assert.equal(small.dark(r, c), true)
  assert.equal(Q.matrix('é'.repeat(10), 'M').size >= 21, true)
})

test('SVG', () => {
  const svg = Q.svg(Q.matrix('Outilo', 'M'), { px: 256, fg: '#000000', bg: '#ffffff', margin: 4 })
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 29 29" width="256"/)
  assert.match(svg, /<path fill="#000000" d="M4 4h1v1h-1z/)
})
