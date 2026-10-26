#!/usr/bin/env node
// Serveur MCP « outilo-mcp » : donne à un assistant IA de quoi créer, tester, relier à Outilo et proposer une extension.
//
//   npx -y -p github:Outilo/outilo outilo-mcp
//
// Transport stdio. Aucune action n'est faite hors du dossier de l'extension, de %APPDATA%\Outilo\dev-links.json
// et, pour la soumission seulement, d'un fork GitHub de l'utilisateur (via la CLI gh).
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { pack, sha256 } from '../scripts/lib/package.mjs'
import { scaffold } from '../scripts/lib/scaffold.mjs'
import { CATEGORIES, KNOWN_PERMISSIONS, validateExtension } from '../scripts/lib/validate.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = 'Outilo/outilo'
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
/** Règles des extensions tierces, sauf pour l'équipe Outilo (OUTILO_OFFICIAL=1). */
const COMMUNITY = process.env.OUTILO_OFFICIAL !== '1'

/** Dossier de données d'Outilo (identique au cœur : %APPDATA%\Outilo sous Windows). */
function dataDir() {
  if (process.env.OUTILO_DATA_DIR) return process.env.OUTILO_DATA_DIR
  if (process.env.APPDATA) return join(process.env.APPDATA, 'Outilo')
  return join(homedir(), '.local', 'share', 'Outilo')
}
const linksFile = () => join(dataDir(), 'dev-links.json')

function readLinks() {
  try {
    return JSON.parse(readFileSync(linksFile(), 'utf8')).folders ?? []
  } catch {
    return []
  }
}

function writeLinks(folders) {
  mkdirSync(dataDir(), { recursive: true })
  writeFileSync(linksFile(), JSON.stringify({ folders }, null, 2) + '\n')
}

const text = s => ({ content: [{ type: 'text', text: s }] })
const fail = s => ({ content: [{ type: 'text', text: s }], isError: true })

function report(r) {
  const lines = [r.ok ? '✓ Extension valide.' : '✗ Extension invalide.']
  for (const e of r.errors) lines.push('Erreur : ' + e)
  for (const w of r.warnings) lines.push('Conseil : ' + w)
  return lines.join('\n')
}

function guide() {
  const parts = [join(ROOT, 'extensions', 'README.md'), join(ROOT, 'docs', 'EXTENSIONS_COMMUNAUTE.md')]
  return parts.filter(existsSync).map(p => readFileSync(p, 'utf8')).join('\n\n---\n\n')
}

const server = new McpServer({ name: 'outilo-mcp', version: pkg.version })

server.registerTool(
  'outilo_guide',
  {
    title: 'Guide des extensions Outilo',
    description:
      'Renvoie la documentation complète pour écrire une extension Outilo : structure, manifeste outilo.toml, permissions, ' +
      'API du SDK window.outilo, composants CSS, règles de publication. À lire avant de créer ou modifier une extension.',
    annotations: { readOnlyHint: true }
  },
  async () => text(guide())
)

server.registerTool(
  'outilo_create_extension',
  {
    title: 'Créer une extension',
    description:
      'Crée le squelette d’une extension dans un dossier vide : manifeste, page, logique testable, test Node, README et CLAUDE.md. ' +
      'Identifiant au format auteur.nom en minuscules (le préfixe « outilo. » est réservé).',
    inputSchema: {
      directory: z.string().describe('Dossier à créer (absent ou vide)'),
      id: z.string().describe('Identifiant, ex. « marie.slugify »'),
      nameFr: z.string(),
      nameEn: z.string().optional(),
      descriptionFr: z.string(),
      descriptionEn: z.string().optional(),
      author: z.string().optional(),
      categories: z.array(z.enum(CATEGORIES)).optional(),
      permissions: z.array(z.enum(Object.keys(KNOWN_PERMISSIONS))).optional().describe('Par défaut : ["clipboard"]')
    }
  },
  async args => {
    const dir = resolve(args.directory)
    try {
      const files = scaffold(dir, args)
      const v = validateExtension(dir, { community: COMMUNITY })
      return text(`Extension créée dans ${dir} :\n- ${files.join('\n- ')}\n\n${report(v)}\n\nÉtape suivante : outilo_link_extension pour la tester dans Outilo.`)
    } catch (e) {
      return fail(e.message)
    }
  }
)

server.registerTool(
  'outilo_validate_extension',
  {
    title: 'Valider une extension',
    description: 'Vérifie le manifeste et les fichiers selon les règles d’Outilo (les mêmes que la CI des soumissions).',
    inputSchema: { directory: z.string() },
    annotations: { readOnlyHint: true }
  },
  async ({ directory }) => {
    return text(report(validateExtension(resolve(directory), { community: COMMUNITY })))
  }
)

server.registerTool(
  'outilo_test_extension',
  {
    title: 'Tester une extension',
    description: 'Lance les tests Node de l’extension (dossier tests/, fichiers *.test.mjs) et renvoie le résultat.',
    inputSchema: { directory: z.string() },
    annotations: { readOnlyHint: true }
  },
  async ({ directory }) => {
    const dir = resolve(directory)
    if (!existsSync(join(dir, 'tests'))) return fail('Aucun dossier tests/ : ajoutez des tests de ui/logic.js (voir le squelette).')
    try {
      const out = execFileSync(process.execPath, ['--test', 'tests/'], { cwd: dir, encoding: 'utf8', timeout: 120000 })
      return text('✓ Tests réussis.\n\n' + out.slice(-4000))
    } catch (e) {
      return fail('✗ Tests en échec.\n\n' + String(e.stdout || e.message).slice(-6000))
    }
  }
)

server.registerTool(
  'outilo_link_extension',
  {
    title: 'Relier à Outilo (bac à sable)',
    description:
      'Ajoute le dossier aux extensions en développement d’Outilo sur ce PC. Il apparaît dans l’application si le mode ' +
      'développeur est activé (Paramètres), avec rechargement automatique et journal des appels (Extensions → Bac à sable).',
    inputSchema: { directory: z.string() }
  },
  async ({ directory }) => {
    const dir = resolve(directory)
    const v = validateExtension(dir, { community: COMMUNITY })
    if (!v.ok) return fail(report(v))
    const links = readLinks().filter(d => resolve(d) !== dir)
    writeLinks([...links, dir])
    return text(
      `Relié : ${dir}\n(${linksFile()})\n\nDans Outilo : Paramètres → Mode développeur. L’extension « ${v.manifest.extension.id} » ` +
        'apparaît avec le badge « Développement » et se recharge à chaque modification. Les actions système sont simulées tant que ' +
        '« Simuler les actions système » est coché dans Extensions → Bac à sable.'
    )
  }
)

server.registerTool(
  'outilo_unlink_extension',
  {
    title: 'Retirer du bac à sable',
    description: 'Retire le dossier des extensions en développement d’Outilo (les fichiers ne sont pas supprimés).',
    inputSchema: { directory: z.string() }
  },
  async ({ directory }) => {
    const dir = resolve(directory)
    writeLinks(readLinks().filter(d => resolve(d) !== dir))
    return text(`Retiré : ${dir}`)
  }
)

server.registerTool(
  'outilo_package_extension',
  {
    title: 'Empaqueter une extension',
    description: 'Crée le paquet .outilo (zip reproductible, non signé) et renvoie son empreinte SHA-256. La signature est faite par la CI d’Outilo à la publication.',
    inputSchema: { directory: z.string(), output: z.string().optional().describe('Dossier de sortie (par défaut : le dossier parent)') }
  },
  async ({ directory, output }) => {
    const dir = resolve(directory)
    const v = validateExtension(dir)
    if (!v.ok) return fail(report(v))
    const { manifest, bytes } = pack(dir)
    const out = resolve(output ?? dirname(dir))
    mkdirSync(out, { recursive: true })
    const file = join(out, `${manifest.extension.id}-${manifest.extension.version}.outilo`)
    writeFileSync(file, bytes)
    return text(`Paquet : ${file}\nTaille : ${bytes.length} octets\nSHA-256 : ${sha256(bytes)}`)
  }
)

server.registerTool(
  'outilo_submit_extension',
  {
    title: 'Proposer l’extension au store Outilo',
    description:
      'Ouvre une Pull Request sur Outilo/outilo avec l’extension (dossier extensions/<id>/), depuis un fork du compte GitHub ' +
      'de l’utilisateur (CLI gh connectée requise). L’équipe Outilo relit puis publie. Action visible publiquement : ' +
      'demandez TOUJOURS la confirmation de l’utilisateur avant de l’appeler.',
    inputSchema: { directory: z.string(), message: z.string().optional().describe('Présentation de l’extension pour les relecteurs') },
    annotations: { destructiveHint: false, openWorldHint: true }
  },
  async ({ directory, message }) => {
    const dir = resolve(directory)
    const v = validateExtension(dir, { community: true })
    if (!v.ok) return fail(report(v))
    const id = v.manifest.extension.id
    const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    let work
    try {
      const login = gh('api', 'user', '--jq', '.login')
      gh('repo', 'fork', REPO, '--clone=false')
      work = mkdtempSync(join(tmpdir(), 'outilo-submit-'))
      git(work, 'clone', '--depth', '1', `https://github.com/${login}/outilo.git`, 'repo')
      const repo = join(work, 'repo')
      git(repo, 'remote', 'add', 'upstream', `https://github.com/${REPO}.git`)
      git(repo, 'fetch', '--depth', '1', 'upstream', 'main')
      const version = v.manifest.extension.version
      const branch = `extension/${id}-v${version}`
      git(repo, 'checkout', '-B', branch, 'upstream/main')
      const target = join(repo, 'extensions', id)
      rmSync(target, { recursive: true, force: true })
      cpSync(dir, target, { recursive: true, filter: src => !/[\\/](node_modules|\.git)([\\/]|$)/.test(src) })
      git(repo, 'add', join('extensions', id))
      git(repo, 'commit', '-m', `extension : ${id} ${version}`)
      git(repo, 'push', '--force', 'origin', branch)
      const body = `${message ?? ''}\n\n---\nExtension \`${id}\` ${version}, proposée avec outilo-mcp.\nPermissions : ${v.permissions.join(', ') || 'aucune'}`
      const url = gh('pr', 'create', '--repo', REPO, '--head', `${login}:${branch}`, '--base', 'main', '--title', `Extension : ${id} ${version}`, '--body', body)
      return text(`Proposition envoyée : ${url}\nLa CI vérifie l’extension, puis l’équipe Outilo la relit avant publication.`)
    } catch (e) {
      const detail = String(e.stderr || e.message)
      if (/ENOENT/.test(detail)) return fail('La CLI GitHub (gh) est introuvable : installez-la puis « gh auth login ».')
      return fail('Échec de la soumission : ' + detail.slice(-2000))
    } finally {
      if (work) rmSync(work, { recursive: true, force: true })
    }
  }
)

server.registerTool(
  'outilo_list_linked',
  {
    title: 'Extensions reliées',
    description: 'Liste les dossiers reliés au bac à sable d’Outilo sur ce PC.',
    annotations: { readOnlyHint: true }
  },
  async () => {
    const links = readLinks()
    return text(links.length ? links.map(d => `- ${d} (${existsSync(d) ? basename(d) : 'introuvable'})`).join('\n') : 'Aucun dossier relié.')
  }
)

await server.connect(new StdioServerTransport())
