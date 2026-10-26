// Serveur MCP outilo-mcp, piloté par un vrai client MCP (stdio).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

test('créer, valider, tester, relier et empaqueter une extension', { timeout: 60000 }, async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'outilo-mcp-'))
  const data = join(tmp, 'data')
  const client = new Client({ name: 'test', version: '1.0.0' })
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [join(import.meta.dirname, '..', 'mcp', 'server.mjs')],
      env: { ...process.env, OUTILO_DATA_DIR: data }
    })
  )
  try {
    const { tools } = await client.listTools()
    const names = tools.map(t => t.name)
    for (const n of ['outilo_guide', 'outilo_create_extension', 'outilo_validate_extension', 'outilo_test_extension', 'outilo_link_extension', 'outilo_package_extension', 'outilo_submit_extension']) {
      assert.ok(names.includes(n), n)
    }
    const call = async (name, args = {}) => {
      const r = await client.callTool({ name, arguments: args })
      return { error: !!r.isError, text: r.content.map(c => c.text).join('\n') }
    }

    assert.match((await call('outilo_guide')).text, /outilo\.toml/)

    const dir = join(tmp, 'slugify')
    const created = await call('outilo_create_extension', { directory: dir, id: 'marie.slugify', nameFr: 'Slugify', descriptionFr: 'Transforme un titre en slug', permissions: ['clipboard'] })
    assert.equal(created.error, false, created.text)
    assert.match(created.text, /✓ Extension valide/)
    assert.ok(existsSync(join(dir, 'CLAUDE.md')))

    assert.equal((await call('outilo_create_extension', { directory: dir, id: 'marie.x', nameFr: 'X', descriptionFr: 'x' })).error, true, 'dossier non vide refusé')

    const tested = await call('outilo_test_extension', { directory: dir })
    assert.equal(tested.error, false, tested.text)

    const linked = await call('outilo_link_extension', { directory: dir })
    assert.equal(linked.error, false, linked.text)
    assert.deepEqual(JSON.parse(readFileSync(join(data, 'dev-links.json'), 'utf8')).folders, [dir])

    const packed = await call('outilo_package_extension', { directory: dir, output: tmp })
    assert.match(packed.text, /SHA-256 : [0-9a-f]{64}/)
    assert.ok(existsSync(join(tmp, 'marie.slugify-0.1.0.outilo')))

    // Règles communautaires
    const bad = join(tmp, 'bad')
    await call('outilo_create_extension', { directory: bad, id: 'outilo.pirate', nameFr: 'P', descriptionFr: 'p', permissions: ['process'] })
    const v = await call('outilo_validate_extension', { directory: bad })
    assert.match(v.text, /réservé aux extensions officielles/)
    writeFileSync(join(bad, 'outilo.toml'), 'pas du toml = = =')
    assert.match((await call('outilo_validate_extension', { directory: bad })).text, /invalide/)

    await call('outilo_unlink_extension', { directory: dir })
    assert.deepEqual(JSON.parse(readFileSync(join(data, 'dev-links.json'), 'utf8')).folders, [])
  } finally {
    await client.close()
  }
})
