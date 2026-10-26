import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { TextLogic: T } = loadLogic('text')
const tr = (s, op) => T.transform(s, op)

test('casses et identifiants', () => {
  assert.equal(tr('élan vital du Projet', 'camel'), 'elanVitalDuProjet')
  assert.equal(tr('getHTTPResponse code', 'snake'), 'get_http_response_code')
  assert.equal(tr('Mon super-Titre !', 'kebab'), 'mon-super-titre')
  assert.equal(tr('user_id', 'pascal'), 'UserId')
  assert.equal(tr('max retry count', 'constant'), 'MAX_RETRY_COUNT')
  assert.equal(tr("l'été à Paris", 'title'), "L'Été À Paris")
  assert.equal(tr('BONJOUR. ÇA VA ? oui', 'sentence'), 'Bonjour. Ça va ? Oui')
  assert.equal(tr('Crème brûlée', 'slug'), 'creme-brulee')
  assert.equal(tr('aBc', 'invert'), 'AbC')
})

test('opérations sur les lignes', () => {
  assert.equal(tr('b\na10\na2\n\nb', 'sort'), '\na2\na10\nb\nb')
  assert.equal(tr('b\na\nb', 'unique'), 'b\na')
  assert.equal(tr(' x \n\n y', 'removeEmpty'), ' x \n y')
  assert.equal(tr('a\nb', 'number'), '1. a\n2. b')
  assert.equal(tr('a\nb\nc', 'shuffle').split('\n').sort().join(''), 'abc')
})

test('statistiques et remplacement', () => {
  const s = T.stats('Bonjour le monde. Ça va ?\n\nOui !')
  assert.equal(s.words, 6)
  assert.equal(s.sentences, 3)
  assert.equal(s.paragraphs, 2)
  assert.equal(s.lines, 3)
  assert.equal(T.stats('é').bytes, 2)
  assert.equal(T.replaceAll('a.b.A', '.', '-', {}), 'a-b-A')
  assert.equal(T.replaceAll('a1b22', '\\d+', '#', { regex: true }), 'a#b#')
  assert.equal(T.replaceAll('Aa', 'a', 'x', { caseSensitive: true }), 'Ax')
})
