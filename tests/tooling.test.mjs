// Outils de publication : empaquetage reproductible, signature, plan de publication incrémental.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import { pack, permissionNames, rawPublicKey, sha256, signBytes, verifyBytes } from '../scripts/lib/package.mjs'

const pem = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' })
const ext = join(import.meta.dirname, '..', 'extensions', 'uuid')

test('paquet reproductible contenant le manifeste à la racine', () => {
  const a = pack(ext)
  const b = pack(ext)
  assert.equal(sha256(a.bytes), sha256(b.bytes))
  const files = Object.keys(unzipSync(new Uint8Array(a.bytes)))
  assert.ok(files.includes('outilo.toml') && files.includes('ui/index.html'), files.join(', '))
  assert.equal(a.manifest.extension.id, 'outilo.uuid')
})

test('signature ed25519 vérifiable avec la clé publique brute', () => {
  const { bytes } = pack(ext)
  const sig = signBytes(bytes, pem)
  const pub = rawPublicKey(pem)
  assert.equal(Buffer.from(pub, 'base64').length, 32)
  assert.ok(verifyBytes(bytes, sig, pub))
  const tampered = Buffer.from(bytes)
  tampered[20] ^= 1
  assert.ok(!verifyBytes(tampered, sig, pub))
})

test('permissions aplaties comme le cœur Rust', () => {
  assert.deepEqual(permissionNames({ clipboard: true, files: { save: true }, network: ['*'], storage: false }), ['clipboard', 'files.save', 'network'])
})

test('publication incrémentale : une version déjà publiée n’est jamais refaite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'outilo-reg-'))
  const index = join(dir, 'index.json')
  const run = () =>
    execFileSync(process.execPath, ['scripts/release-extensions.mjs', '--index', index, '--out', join(dir, 'out')], {
      cwd: join(import.meta.dirname, '..'),
      env: { ...process.env, OUTILO_SIGNING_KEY: pem },
      encoding: 'utf8'
    })
  run()
  const first = JSON.parse(readFileSync(index, 'utf8'))
  assert.ok(Object.keys(first.extensions).length >= 17)
  const pw = first.extensions['outilo.password'].versions['1.0.0']
  assert.match(pw.url, /^https:\/\/github\.com\/Outilo\/outilo\/releases\/download\/password-v1\.0\.0\/outilo\.password-1\.0\.0\.outilo$/)
  assert.ok(verifyBytes(readFileSync(join(dir, 'out', 'outilo.password-1.0.0.outilo')), pw.signature, rawPublicKey(pem)))
  assert.ok(first.packs.dev.includes('outilo.json'))

  assert.match(run(), /Aucune nouvelle version/)
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'out', 'plan.json'), 'utf8')), [])
})

test('validateur JS aligné sur le cœur Rust, extensions officielles valides', async () => {
  const { validateExtension, KNOWN_PERMISSIONS } = await import('../scripts/lib/validate.mjs')
  const rust = readFileSync(join(import.meta.dirname, '..', 'src-tauri', 'src', 'manifest.rs'), 'utf8')
  const list = [...rust.matchAll(/\("([a-z.]+)", (true|false)\)/g)].map(m => [m[1], m[2] === 'true'])
  assert.deepEqual(Object.fromEntries(list), KNOWN_PERMISSIONS)
  const root = join(import.meta.dirname, '..', 'extensions')
  for (const name of readdirSync(root).filter(n => existsSync(join(root, n, 'outilo.toml')))) {
    const r = validateExtension(join(root, name))
    assert.ok(r.ok, `${name} : ${r.errors.join(' ; ')}`)
  }
  // Règles communautaires : préfixe réservé et permissions sensibles refusés
  const cleaner = validateExtension(join(root, 'cleaner'), { community: true })
  assert.ok(cleaner.errors.some(e => e.includes('réservé')) && cleaner.errors.some(e => e.includes('sensible')))
})

test('signature de l’installateur et latest.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'outilo-app-'))
  const exe = join(dir, 'setup.exe')
  writeFileSync(exe, Buffer.from('installateur factice'))
  execFileSync(process.execPath, ['scripts/sign-installer.mjs', exe, 'v0.6.0', 'https://exemple.com/setup.exe', join(dir, 'latest.json'), 'notes'], {
    cwd: join(import.meta.dirname, '..'),
    env: { ...process.env, OUTILO_SIGNING_KEY: pem }
  })
  const latest = JSON.parse(readFileSync(join(dir, 'latest.json'), 'utf8'))
  assert.equal(latest.version, '0.6.0')
  assert.equal(latest.size, 20)
  assert.equal(latest.sha256, sha256(readFileSync(exe)))
  assert.ok(verifyBytes(readFileSync(exe), latest.signature, rawPublicKey(pem)))
})
