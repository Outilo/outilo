// Génère la paire de clés qui signe les extensions publiées dans le registre.
//   npm run keygen [-- chemin/de/la/cle.pem]
// La clé privée est écrite dans un fichier (jamais affichée) ; seule la clé publique s'affiche.
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { rawPublicKey } from './lib/package.mjs'

const out = resolve(process.argv[2] ?? 'outilo-signing-key.pem')
if (existsSync(out)) {
  console.error(`${out} existe déjà : choisissez un autre chemin, une clé ne doit jamais être écrasée.`)
  process.exit(1)
}
const { privateKey } = generateKeyPairSync('ed25519')
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
writeFileSync(out, pem, { mode: 0o600 })

console.log(`Clé privée écrite dans : ${out}`)
console.log('')
console.log('Clé publique (à ajouter dans src-tauri/keys/registry.pub) :')
console.log(rawPublicKey(pem))
console.log('')
console.log('Ensuite :')
console.log('  1. Copiez le contenu du fichier .pem dans le secret GitHub OUTILO_SIGNING_KEY')
console.log('     (dépôt Outilo/outilo → Settings → Secrets and variables → Actions).')
console.log('  2. Rangez le fichier .pem dans votre gestionnaire de mots de passe, puis supprimez-le.')
console.log('  3. Ne le committez jamais (*.pem est ignoré par git).')
