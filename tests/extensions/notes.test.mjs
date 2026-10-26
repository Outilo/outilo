import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { NotesLogic: N } = loadLogic('notes')

test('titre et extrait', () => {
  assert.equal(N.title('\n## Réunion lundi\n- point 1'), 'Réunion lundi')
  assert.equal(N.title('- [x] acheter du café'), 'acheter du café')
  assert.equal(N.excerpt('Titre\n**gras** et `code`\n\nsuite'), 'gras et code suite')
})

test('recherche et tri', () => {
  const notes = [
    { id: 1, body: 'Été à Lyon', pinned: 0, updated: 3 },
    { id: 2, body: 'Liste des courses', pinned: 1, updated: 1 },
    { id: 3, body: 'ete prochain', pinned: 0, updated: 5 }
  ]
  assert.deepEqual([...N.filter(notes, '')].map(n => n.id), [2, 3, 1])
  assert.deepEqual([...N.filter(notes, 'ÉTÉ')].map(n => n.id), [3, 1])
  assert.deepEqual([...N.filter(notes, 'ete lyon')].map(n => n.id), [1])
  assert.equal(N.exportMarkdown(notes.slice(0, 2)), 'Été à Lyon\n\n---\n\nListe des courses\n')
  assert.match(N.SCHEMA, /CREATE TABLE IF NOT EXISTS note/)
})
