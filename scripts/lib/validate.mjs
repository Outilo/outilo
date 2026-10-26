// Validation d'une extension, partagée par le serveur MCP et la CI des soumissions.
// Mêmes règles que le cœur Rust (src-tauri/src/manifest.rs) ; tests/tooling.test.mjs vérifie qu'elles restent alignées.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, normalize } from 'node:path'
import { parse } from 'smol-toml'
import { permissionNames } from './package.mjs'

export const API_VERSION = '1'
export const KNOWN_PERMISSIONS = {
  clipboard: false,
  storage: false,
  'storage.sql': false,
  'files.save': false,
  'files.pick': false,
  'system.info': false,
  network: false,
  'files.scoped': true,
  process: true,
  'shell.safe': true
}
export const CATEGORIES = ['securite', 'generateur', 'donnees', 'code', 'texte', 'reseau', 'systeme', 'design', 'autres']
const MAX_PACKAGE = 30 * 1024 * 1024
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/

export function isValidId(id) {
  const parts = String(id).split('.')
  return parts.length >= 2 && id.length <= 64 && parts.every(p => p && !p.startsWith('-') && /^[a-z0-9-]+$/.test(p))
}

function safeRelative(p) {
  return typeof p === 'string' && p !== '' && !isAbsolute(p) && !/^[a-zA-Z]:/.test(p) && !normalize(p).split(/[\\/]/).includes('..')
}

function hostOk(h) {
  if (h === '*') return true
  const name = h.startsWith('*.') ? h.slice(2) : h
  return name.length > 0 && name.length <= 253 && name.split('.').every(l => /^[A-Za-z0-9-]+$/.test(l))
}

function size(dir) {
  let total = 0
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    total += st.isDirectory() ? size(p) : st.size
  }
  return total
}

/**
 * Vérifie un dossier d'extension. `community` : règles des extensions tierces (préfixe `outilo.` réservé,
 * pas de permission sensible ni de réseau illimité). Renvoie { ok, errors, warnings, manifest }.
 */
export function validateExtension(dir, { community = false } = {}) {
  const errors = []
  const warnings = []
  const file = join(dir, 'outilo.toml')
  if (!existsSync(file)) return { ok: false, errors: ['outilo.toml introuvable dans ' + dir], warnings, manifest: null }
  let m
  try {
    m = parse(readFileSync(file, 'utf8'))
  } catch (e) {
    return { ok: false, errors: ['outilo.toml invalide : ' + e.message], warnings, manifest: null }
  }
  const ext = m.extension ?? {}
  if (!isValidId(ext.id)) errors.push(`identifiant invalide « ${ext.id} » (attendu : auteur.nom, en minuscules)`)
  if (community && String(ext.id).startsWith('outilo.')) errors.push('le préfixe « outilo. » est réservé aux extensions officielles')
  if (!ext.name) errors.push('[extension].name manquant')
  if (!SEMVER.test(String(ext.version))) errors.push(`version invalide « ${ext.version} » (semver, ex. 1.0.0)`)
  if (String(ext.api) !== API_VERSION) errors.push(`api = "${ext.api}" : cette version d'Outilo supporte l'API ${API_VERSION}`)
  if (!ext.license) warnings.push('licence non précisée ([extension].license)')
  if (!ext.description) warnings.push('description manquante : elle s’affiche dans le catalogue')
  if (typeof ext.name === 'string') warnings.push('nom non traduit : préférez name = { fr = "…", en = "…" }')
  for (const c of ext.categories ?? []) if (!CATEGORIES.includes(c)) warnings.push(`catégorie inconnue « ${c} »`)
  const entry = m.ui?.entry
  if (!m.ui) errors.push('section [ui] manquante')
  else if (!safeRelative(entry)) errors.push('[ui].entry doit être un chemin relatif dans le dossier')
  else if (!existsSync(join(dir, entry))) errors.push(`fichier d'entrée introuvable : ${entry}`)
  if (ext.icon && (!safeRelative(ext.icon) || !existsSync(join(dir, ext.icon)))) errors.push(`icône introuvable : ${ext.icon}`)
  if (!ext.icon) warnings.push('aucune icône (icon = "icon.svg")')
  const perms = permissionNames(m.permissions)
  for (const p of perms) {
    if (!(p in KNOWN_PERMISSIONS)) errors.push(`permission inconnue « ${p} »`)
    else if (community && KNOWN_PERMISSIONS[p]) errors.push(`permission sensible « ${p} » réservée aux extensions officielles`)
  }
  const net = m.permissions?.network
  if (net !== undefined && net !== false) {
    if (!Array.isArray(net) || !net.length || !net.every(h => typeof h === 'string' && hostOk(h))) {
      errors.push('network attend une liste de domaines, ex. ["api.exemple.com"]')
    } else if (community && net.includes('*')) errors.push('network = ["*"] est réservé aux extensions officielles')
  }
  for (const c of m.commands ?? []) if (!c.id || !c.title) errors.push('chaque [[commands]] demande un id et un title')
  if (existsSync(dir) && size(dir) > MAX_PACKAGE) errors.push('extension trop volumineuse (30 Mo maximum)')
  const html = entry && existsSync(join(dir, entry)) ? readFileSync(join(dir, entry), 'utf8') : ''
  if (html && !html.includes('/_sdk/outilo-sdk.js')) warnings.push('la page n’inclut pas /_sdk/outilo-sdk.js : aucune API ne sera disponible')
  if (/https?:\/\/(?!localhost)[^"']+\.(js|css)["']/.test(html)) errors.push('ressource externe dans la page : tout doit être inclus dans l’extension (pas de réseau)')
  return { ok: !errors.length, errors, warnings, manifest: m, permissions: perms }
}
