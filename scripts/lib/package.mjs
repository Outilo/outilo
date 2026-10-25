// Empaquetage et signature des extensions (.outilo = archive zip signée en ed25519).
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { zipSync } from 'fflate'
import { parse } from 'smol-toml'

/** Date fixe : deux paquets du même contenu sont identiques octet pour octet. */
const EPOCH = new Date('2026-01-01T00:00:00Z')

function files(dir, root = dir) {
  return readdirSync(dir)
    .filter(name => !name.startsWith('.'))
    .sort()
    .flatMap(name => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? files(path, root) : [relative(root, path).split(sep).join('/')]
    })
}

export function readManifest(dir) {
  return parse(readFileSync(join(dir, 'outilo.toml'), 'utf8'))
}

/** Permissions sous forme de clés pointées, comme le cœur Rust (manifest.rs). */
export function permissionNames(table, prefix = '', out = []) {
  for (const [k, v] of Object.entries(table ?? {})) {
    const name = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) permissionNames(v, name, out)
    else if (v !== false) out.push(name)
  }
  return out.sort()
}

export function pack(dir) {
  const manifest = readManifest(dir)
  const entries = {}
  for (const f of files(dir)) entries[f] = [readFileSync(join(dir, f)), { mtime: EPOCH }]
  const bytes = Buffer.from(zipSync(entries, { level: 9 }))
  return { manifest, bytes }
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function signBytes(bytes, privatePem) {
  return sign(null, bytes, createPrivateKey(privatePem)).toString('base64')
}

/** Clé publique brute (32 octets, base64) : le format de keys/registry.pub. */
export function rawPublicKey(privateOrPublicPem) {
  const der = createPublicKey(privateOrPublicPem).export({ type: 'spki', format: 'der' })
  return der.subarray(der.length - 32).toString('base64')
}

export function verifyBytes(bytes, signature, rawPublicB64) {
  const prefix = Buffer.from('302a300506032b6570032100', 'hex')
  const key = createPublicKey({ key: Buffer.concat([prefix, Buffer.from(rawPublicB64, 'base64')]), format: 'der', type: 'spki' })
  return verify(null, bytes, key, Buffer.from(signature, 'base64'))
}
