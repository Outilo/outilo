import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { MdLogic: M } = loadLogic('markdown', ['vendor/marked.umd.js'])

test('rendu GFM', () => {
  const html = M.render('# Titre\n\n- [x] fait\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n`code`')
  assert.match(html, /<h1[^>]*>Titre<\/h1>/)
  assert.match(html, /<table>/)
  assert.match(html, /<code>code<\/code>/)
  assert.match(html, /type="checkbox"/)
})

test('assainissement', () => {
  const html = M.render('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[lien](javascript:alert(1))')
  assert.doesNotMatch(html, /<script|onerror|javascript:/i)
  assert.equal(M.sanitize('<a href="https://exemple.com" onclick=\'x()\'>ok</a>'), '<a href="https://exemple.com">ok</a>')
})

test('sommaire et document', () => {
  const toc = [...M.toc('# Un\n```\n# pas un titre\n```\n## Été chaud ##')].map(x => ({ ...x }))
  assert.deepEqual(toc, [{ level: 1, text: 'Un', id: 'un' }, { level: 2, text: 'Été chaud', id: 'ete-chaud' }])
  assert.match(M.documentHtml('<p>x</p>', 'A <b>'), /<title>A &lt;b&gt;<\/title>/)
})
