// CI des propositions d'extensions : valide les dossiers d'extensions modifiés et lance leurs tests.
//   node scripts/check-extensions.mjs <dossier> [<dossier>…]
// Les extensions tierces (identifiant hors « outilo. ») suivent les règles communautaires.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { validateExtension } from './lib/validate.mjs'

const dirs = process.argv.slice(2).map(d => resolve(d)).filter(d => existsSync(join(d, 'outilo.toml')))
if (!dirs.length) {
  console.log('Aucune extension modifiée.')
  process.exit(0)
}

let failed = false
const summary = []
for (const dir of dirs) {
  const raw = validateExtension(dir)
  const id = raw.manifest?.extension?.id ?? dir
  const community = !String(id).startsWith('outilo.')
  const r = validateExtension(dir, { community })
  summary.push(`### ${id} ${raw.manifest?.extension?.version ?? ''} ${community ? '(communauté)' : '(officielle)'}`)
  summary.push(r.ok ? '- ✓ manifeste et fichiers valides' : '- ✗ invalide')
  for (const e of r.errors) summary.push(`- Erreur : ${e}`)
  for (const w of r.warnings) summary.push(`- Conseil : ${w}`)
  summary.push(`- Permissions : ${(r.permissions ?? []).join(', ') || 'aucune'}`)
  if (!r.ok) failed = true
  // Tests propres à l'extension (les officielles sont testées par tests/extensions/)
  const tests = join(dir, 'tests')
  if (existsSync(tests) && readdirSync(tests).some(f => f.endsWith('.test.mjs'))) {
    try {
      execFileSync(process.execPath, ['--test', 'tests/'], { cwd: dir, stdio: 'pipe', timeout: 120000 })
      summary.push('- ✓ tests réussis')
    } catch (e) {
      summary.push('- ✗ tests en échec')
      console.error(String(e.stdout || e.message))
      failed = true
    }
  } else if (community) {
    summary.push('- Conseil : ajoutez des tests (dossier tests/)')
  }
  summary.push('')
}
console.log(summary.join('\n'))
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs')
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Vérification des extensions\n\n' + summary.join('\n') + '\n')
}
process.exit(failed ? 1 : 0)
