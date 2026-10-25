import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { parse } from 'smol-toml'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname)
const extDir = join(root, 'extensions')
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json'
}

function flatten(prefix: string, table: Record<string, unknown>, out: string[]) {
  for (const [k, v] of Object.entries(table)) {
    const name = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(name, v as Record<string, unknown>, out)
    else if (v !== false) out.push(name)
  }
}

function previewExtensions() {
  const sensitive = ['files.scoped', 'process', 'shell.safe']
  return readdirSync(extDir)
    .map(d => join(extDir, d))
    .filter(d => existsSync(join(d, 'outilo.toml')))
    .map(dir => {
      const m = parse(readFileSync(join(dir, 'outilo.toml'), 'utf8')) as any
      const permissions: string[] = []
      flatten('', m.permissions ?? {}, permissions)
      return {
        id: m.extension.id,
        name: m.extension.name,
        description: m.extension.description ?? null,
        version: m.extension.version,
        authors: m.extension.authors ?? [],
        categories: m.extension.categories ?? [],
        entry: m.ui.entry,
        icon: m.extension.icon ?? null,
        commands: m.commands ?? [],
        permissions: permissions.sort(),
        sensitive: permissions.filter(p => sensitive.includes(p)),
        hosts: Array.isArray(m.permissions?.network) ? m.permissions.network : [],
        previous: null,
        source: 'official',
        enabled: true,
        path: dir
      }
    })
}

function previewThemes() {
  const dir = join(root, 'src-tauri', 'themes')
  return readdirSync(dir).map(f => {
    const t = parse(readFileSync(join(dir, f), 'utf8')) as any
    return {
      id: t.meta.id,
      name: t.meta.name,
      mode: t.meta.mode,
      colors: t.colors,
      radius: t.shape?.radius ?? null,
      fontUi: t.font?.ui ?? null,
      fontMono: t.font?.mono ?? null,
      css: null,
      builtin: true
    }
  })
}

function serveFile(base: string, rel: string, res: any): boolean {
  const file = normalize(join(base, rel))
  if (!file.startsWith(base + sep) || !existsSync(file) || !statSync(file).isFile()) return false
  res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(readFileSync(file))
  return true
}

/** Aperçu navigateur (`npm run dev` sans Tauri) : sert les extensions du dépôt comme le ferait le cœur Rust. */
function previewPlugin(): Plugin {
  return {
    name: 'outilo-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? '').split('?')[0])
        if (url === '/__dev/extensions.json') {
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ items: previewExtensions(), warnings: [] }))
        }
        if (url === '/__dev/themes.json') {
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ themes: previewThemes(), warnings: [] }))
        }
        if (url.startsWith('/_sdk/') && serveFile(join(root, 'sdk'), url.slice(6), res)) return
        const m = /^\/__dev\/ext\/([^/]+)\/(.+)$/.exec(url)
        if (m) {
          const ext = previewExtensions().find(e => e.id === m[1])
          if (ext && serveFile(ext.path, m[2], res)) return
          res.statusCode = 404
          return res.end('introuvable')
        }
        next()
      })
    }
  }
}

// Tauri attend un port fixe et ne doit pas masquer les erreurs Rust
export default defineConfig({
  plugins: [vue(), previewPlugin()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: { target: 'chrome120', outDir: 'dist', emptyOutDir: true }
})
