// Prépare la publication des extensions dont la version n'est pas encore dans le registre.
//
//   node scripts/release-extensions.mjs --index <index.json> --out <dossier> [--repo Outilo/outilo]
//
// Clé privée : variable d'environnement OUTILO_SIGNING_KEY (contenu PEM). Pour chaque extension nouvelle
// ou mise à jour : écrit le paquet signé dans <dossier>, ajoute la version à l'index, et liste les Releases
// GitHub à créer dans <dossier>/plan.json. Les autres extensions ne sont pas touchées.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { pack, permissionNames, rawPublicKey, sha256, signBytes, verifyBytes } from './lib/package.mjs'

const { values: args } = parseArgs({
  options: { index: { type: 'string' }, out: { type: 'string' }, repo: { type: 'string', default: 'Outilo/outilo' } }
})
if (!args.index || !args.out) {
  console.error('Usage : node scripts/release-extensions.mjs --index <index.json> --out <dossier>')
  process.exit(2)
}

const key = process.env.OUTILO_SIGNING_KEY
if (!key) {
  console.error('OUTILO_SIGNING_KEY absente : aucun paquet ne peut être signé.')
  process.exit(3)
}

const root = resolve(import.meta.dirname, '..')
const extDir = join(root, 'extensions')
const out = resolve(args.out)
mkdirSync(out, { recursive: true })

const index = existsSync(args.index)
  ? JSON.parse(readFileSync(args.index, 'utf8'))
  : { schema: 1, generated: '', extensions: {}, packs: {} }

const plan = []
for (const name of readdirSync(extDir).sort()) {
  const dir = join(extDir, name)
  if (!existsSync(join(dir, 'outilo.toml'))) continue
  const { manifest, bytes } = pack(dir)
  const { id, version, api } = manifest.extension
  const entry = (index.extensions[id] ??= { name: manifest.extension.name, versions: {} })
  // Métadonnées toujours à jour, versions publiées jamais modifiées
  entry.name = manifest.extension.name
  entry.description = manifest.extension.description ?? null
  entry.categories = manifest.extension.categories ?? []
  if (entry.versions[version]) continue

  const tag = `${name}-v${version}`
  const file = `${id}-${version}.outilo`
  const signature = signBytes(bytes, key)
  if (!verifyBytes(bytes, signature, rawPublicKey(key))) throw new Error(`${id} : signature incohérente`)
  writeFileSync(join(out, file), bytes)
  entry.versions[version] = {
    api: String(api),
    url: `https://github.com/${args.repo}/releases/download/${tag}/${file}`,
    sha256: sha256(bytes),
    signature,
    permissions: permissionNames(manifest.permissions),
    size: bytes.length
  }
  plan.push({ id, version, tag, file, title: `${typeof entry.name === 'string' ? entry.name : entry.name.fr} ${version}` })
  console.log(`+ ${id} ${version} (${bytes.length} octets)`)
}

index.schema = 1
index.packs = JSON.parse(readFileSync(join(root, 'scripts', 'packs.json'), 'utf8'))
index.generated = new Date().toISOString()
writeFileSync(args.index, JSON.stringify(index, null, 2) + '\n')
writeFileSync(join(out, 'plan.json'), JSON.stringify(plan, null, 2) + '\n')
console.log(plan.length ? `${plan.length} extension(s) à publier.` : 'Aucune nouvelle version : rien à publier.')
