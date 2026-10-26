import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadLogic } from './helper.mjs'
import { KNOWN_PERMISSIONS } from '../../scripts/lib/validate.mjs'

const { DevLogic: D } = loadLogic('devdocs', ['vendor/smol-toml.js'])
const root = join(import.meta.dirname, '..', '..', 'extensions')

test('mêmes permissions que le validateur de la CI', () => {
  assert.deepEqual({ ...D.KNOWN }, KNOWN_PERMISSIONS)
})

test('toutes les extensions officielles passent la vérification', () => {
  for (const name of readdirSync(root).filter(n => existsSync(join(root, n, 'outilo.toml')))) {
    const r = D.validate(readFileSync(join(root, name, 'outilo.toml'), 'utf8'), false)
    assert.ok(r.ok, `${name} : ${[...r.errors].join(', ')}`)
  }
})

test('erreurs et règles du store', () => {
  const base = '[extension]\nid = "marie.slugify"\nname = { fr = "S", en = "S" }\nversion = "0.1.0"\napi = "1"\n[ui]\nentry = "ui/index.html"\n'
  assert.ok(D.validate(base, true).ok)
  assert.deepEqual([...D.validate(base.replace('0.1.0', '1.0'), true).errors], ['version'])
  assert.deepEqual([...D.validate(base + '[permissions]\nprocess = true\nnetwork = ["*"]\n', true).errors], ['sensitive:process', 'networkAll'])
  assert.deepEqual([...D.validate(base.replace('marie.slugify', 'outilo.x'), true).errors], ['reserved'])
  assert.deepEqual([...D.validate(base + '[permissions]\nroot = true\n', false).errors], ['unknown:root'])
  assert.match(D.validate('= nope', false).errors[0], /^TOML/)
  assert.match(D.mcpConfig('claude-code'), /^claude mcp add outilo -- npx -y -p github:Outilo\/outilo outilo-mcp$/)
  assert.equal(JSON.parse(D.mcpConfig('vscode')).servers.outilo.type, 'stdio')
})
