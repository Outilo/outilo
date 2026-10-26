// Signe l'installateur de l'application et écrit latest.json (lu par Outilo pour se mettre à jour).
//   node scripts/sign-installer.mjs <installateur.exe> <version> <url de téléchargement> <sortie latest.json> [notes]
// Clé privée : variable d'environnement OUTILO_SIGNING_KEY (même clé que les extensions).
import { readFileSync, writeFileSync } from 'node:fs'
import { rawPublicKey, sha256, signBytes, verifyBytes } from './lib/package.mjs'

const [file, version, url, out, notes = ''] = process.argv.slice(2)
if (!file || !version || !url || !out) {
  console.error('Usage : node scripts/sign-installer.mjs <installateur.exe> <version> <url> <latest.json> [notes]')
  process.exit(2)
}
const key = process.env.OUTILO_SIGNING_KEY
if (!key) {
  console.error('OUTILO_SIGNING_KEY absente : installateur non signé, pas de mise à jour automatique.')
  process.exit(3)
}
const bytes = readFileSync(file)
const signature = signBytes(bytes, key)
if (!verifyBytes(bytes, signature, rawPublicKey(key))) throw new Error('signature incohérente')
const latest = { version: version.replace(/^v/, ''), notes, url, sha256: sha256(bytes), signature, size: bytes.length }
writeFileSync(out, JSON.stringify(latest, null, 2) + '\n')
console.log(`latest.json : ${latest.version}, ${bytes.length} octets`)
