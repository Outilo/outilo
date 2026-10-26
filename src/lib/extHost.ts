// Pont entre les cadres d'extension (iframes isolées) et le cœur.
// Chaque appel est vérifié contre les permissions déclarées dans le manifeste de l'extension.
import { api, UnavailableError } from './api'
import { locale, t } from './i18n'
import { handleShortcut, logDevCall, store, themeState, toast } from './store'

interface Frame {
  extId: string
  tabKey: string
  ready: boolean
  queue: string[]
}

const frames = new Map<Window, Frame>()

const METHOD_PERMISSION: Record<string, string | null> = {
  'clipboard.write': 'clipboard',
  'storage.get': 'storage',
  'storage.set': 'storage',
  'storage.remove': 'storage',
  'storage.keys': 'storage',
  'files.save': 'files.save',
  'sql.query': 'storage.sql',
  'sql.exec': 'storage.sql',
  'system.info': 'system.info',
  'process.list': 'process',
  'process.ports': 'process',
  'process.kill': 'process',
  'net.fetch': 'network',
  'net.lookup': 'network',
  'net.tcp': 'network',
  'net.ping': 'network',
  'net.interfaces': 'network',
  'shell.flushDns': 'shell.safe',
  'clean.scan': 'files.scoped',
  'clean.run': 'files.scoped',
  toast: null
}

const str = (v: unknown) => (v == null ? undefined : String(v))

export function registerFrame(win: Window, extId: string, tabKey: string) {
  frames.set(win, { extId, tabKey, ready: false, queue: [] })
}

export function unregisterFrame(win: Window) {
  frames.delete(win)
}

/** Le cadre peut être en cours de chargement : la commande est alors mise en attente. */
export function sendCommand(tabKey: string, command: string) {
  const entry = [...frames.entries()].find(([, f]) => f.tabKey === tabKey)
  if (entry?.[1].ready) post(entry[0], { kind: 'command', command })
  else pendingCommands.set(tabKey, command)
}
const pendingCommands = new Map<string, string>()

export function broadcast(msg: Record<string, unknown>) {
  for (const [win, f] of frames) if (f.ready) post(win, msg)
}

function post(win: Window, msg: Record<string, unknown>) {
  // Les cadres ont une origine opaque : seule la cible « * » est possible. Aucune donnée secrète n'est envoyée.
  win.postMessage({ __outilo: 1, ...msg }, '*')
}

window.addEventListener('message', async event => {
  const win = event.source as Window | null
  const frame = win ? frames.get(win) : undefined
  const m = event.data
  if (!win || !frame || !m || m.__outilo !== 1) return

  if (m.kind === 'hello') {
    frame.ready = true
    const theme = themeState.value
    post(win, { kind: 'init', id: frame.extId, locale: locale.value, vars: theme?.vars ?? {}, mode: theme?.mode ?? 'dark' })
    const cmd = pendingCommands.get(frame.tabKey)
    if (cmd) {
      pendingCommands.delete(frame.tabKey)
      post(win, { kind: 'command', command: cmd })
    }
    return
  }
  if (m.kind === 'key') {
    handleShortcut(String(m.key), Boolean(m.shift))
    return
  }
  if (m.kind === 'call') {
    const method = String(m.method)
    const start = performance.now()
    const dev = store.extensions.find(e => e.id === frame.extId)?.source === 'dev'
    const simulated = dev && store.settings.devSimulate && method in SIMULATED
    const log = (error?: string) =>
      dev && logDevCall({ time: Date.now(), extId: frame.extId, method, ms: Math.round(performance.now() - start), error, simulated })
    try {
      const result = simulated ? await simulate(frame.extId, method) : await handleCall(frame.extId, method, m.params ?? {})
      log()
      post(win, { kind: 'reply', id: m.id, result })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      log(error)
      post(win, { kind: 'reply', id: m.id, error })
    }
  }
})

/** Bac à sable : actions destructrices simulées pour les extensions en développement (réponse type de l'API). */
const SIMULATED: Record<string, unknown> = {
  'process.kill': true,
  'clean.run': { bytes: 0, files: 0, skipped: 0 },
  'shell.flushDns': true
}

async function simulate(extId: string, method: string): Promise<unknown> {
  const ext = store.extensions.find(e => e.id === extId)
  const permission = METHOD_PERMISSION[method]
  // Les permissions restent vérifiées : le bac à sable ne remplace que l'effet
  if (permission && !ext?.permissions.includes(permission)) throw new Error(`${t('err.permission')} : ${permission}`)
  toast(t('dev.simulated', { method }), 'info')
  return SIMULATED[method]
}

async function handleCall(extId: string, method: string, p: Record<string, any>): Promise<unknown> {
  const ext = store.extensions.find(e => e.id === extId)
  if (!ext?.enabled) throw new Error('extension inactive')
  if (!(method in METHOD_PERMISSION)) throw new Error(`méthode inconnue : ${method}`)
  const permission = METHOD_PERMISSION[method]
  if (permission && !ext.permissions.includes(permission)) {
    throw new Error(`${t('err.permission')} : ${permission}`)
  }
  try {
    switch (method) {
      case 'clipboard.write':
        await navigator.clipboard.writeText(String(p.text))
        return true
      case 'storage.get':
        return api.extStorage(extId, 'get', String(p.key))
      case 'storage.set':
        return api.extStorage(extId, 'set', String(p.key), p.value)
      case 'storage.remove':
        return api.extStorage(extId, 'remove', String(p.key))
      case 'storage.keys':
        return api.extStorage(extId, 'keys')
      case 'files.save':
        return api.extSaveFile(extId, String(p.name), String(p.content), p.encoding === 'base64' ? 'base64' : undefined)
      case 'sql.query':
        return api.ext('sql', extId, { sql: String(p.sql), params: Array.isArray(p.params) ? p.params : [] })
      case 'sql.exec':
        return api.ext('sql', extId, { sql: String(p.sql), script: true })
      case 'system.info':
        return api.ext('system_info', extId)
      case 'process.list':
        return api.ext('processes', extId)
      case 'process.ports':
        return api.ext('ports', extId)
      case 'process.kill':
        return api.ext('kill', extId, { pid: Number(p.pid) })
      case 'net.fetch': {
        const headers: Record<string, string> = {}
        for (const [k, v] of Object.entries(p.headers ?? {})) headers[String(k)] = String(v)
        return api.ext('net_fetch', extId, { url: String(p.url), method: str(p.method), headers, body: str(p.body) })
      }
      case 'net.lookup':
        return api.ext('net_lookup', extId, { host: String(p.host) })
      case 'net.tcp':
        return api.ext('net_tcp', extId, { host: String(p.host), port: Number(p.port), timeout: Number(p.timeout) || undefined })
      case 'net.ping':
        return api.ext('net_ping', extId, { host: String(p.host), count: Number(p.count) || undefined })
      case 'net.interfaces':
        return api.ext('net_interfaces', extId)
      case 'shell.flushDns':
        return api.ext('flush_dns', extId)
      case 'clean.scan':
        return api.ext('clean_scan', extId)
      case 'clean.run':
        return api.ext('clean_run', extId, { targets: Array.isArray(p.targets) ? p.targets.map(String) : [] })
      case 'toast':
        toast(String(p.message).slice(0, 300), p.type === 'error' || p.type === 'success' ? p.type : 'info')
        return true
    }
  } catch (e) {
    if (e instanceof UnavailableError) throw new Error(t('err.unavailable'))
    throw e
  }
}
