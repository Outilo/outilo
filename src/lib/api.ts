// Accès au cœur Rust. Hors de Tauri (aperçu `npm run dev` dans un navigateur), une implémentation
// de secours lit les extensions du dépôt via le serveur Vite et garde l'état dans localStorage.
import { invoke, isTauri } from '@tauri-apps/api/core'
import type { AppInfo, AppUpdate, BundledInfo, CheckResult, ExtInfo, ExtList, ThemeDef, ThemeList } from './types'

export const inTauri = isTauri()

export class UnavailableError extends Error {}

export const api = {
  appInfo: () => call<AppInfo>('app_info'),
  getSettings: () => call<Record<string, unknown>>('get_settings'),
  saveSettings: (settings: object) => call<void>('save_settings', { settings }),
  listExtensions: () => call<ExtList>('list_extensions'),
  reloadExtensions: () => call<ExtList>('reload_extensions'),
  setExtensionEnabled: (id: string, enabled: boolean) => call<ExtList>('set_extension_enabled', { id, enabled }),
  uninstallExtension: (id: string) => call<ExtList>('uninstall_extension', { id }),
  restoreOfficialExtensions: () => call<ExtList>('restore_official_extensions'),
  listBundled: () => call<BundledInfo[]>('list_bundled'),
  chooseExtensions: (ids: string[]) => call<ExtList>('choose_extensions', { ids }),
  installBundled: (id: string) => call<ExtList>('install_bundled', { id }),
  addDevExtension: () => call<ExtList | null>('add_dev_extension'),
  registryCheck: () => call<CheckResult>('registry_check'),
  appUpdateCheck: () => call<AppUpdate>('app_update_check'),
  appUpdateInstall: () => call<void>('app_update_install'),
  registryInstall: (id: string) => call<ExtList>('registry_install', { id }),
  registryRollback: (id: string) => call<ExtList>('registry_rollback', { id }),
  devFingerprint: () => call<Record<string, string>>('dev_fingerprint'),
  setShellOptions: (options: { closeToTray: boolean; shortcut: string | null; locale: string }) =>
    call<void>('set_shell_options', { options }),
  /** Commandes de l'API des extensions : `ext_<nom>`, toujours avec l'identifiant de l'extension appelante. */
  ext: (command: string, id: string, args: Record<string, unknown> = {}) => call<unknown>(`ext_${command}`, { id, ...args }),
  extStorage: (id: string, op: 'get' | 'set' | 'remove' | 'keys', key?: string, value?: unknown) =>
    call<unknown>('ext_storage', { id, op, key, value }),
  extSaveFile: (id: string, name: string, content: string, encoding?: 'base64') =>
    call<boolean>('ext_save_file', { id, name, content, encoding }),
  listThemes: () => call<ThemeList>('list_themes'),
  importTheme: () => call<ThemeDef | null>('import_theme'),
  exportTheme: (name: string, content: string) => call<boolean>('export_theme', { name, content }),
  deleteTheme: (id: string) => call<void>('delete_theme', { id })
}

function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return inTauri ? invoke<T>(cmd, args) : (preview(cmd, args ?? {}) as Promise<T>)
}

// ---------- Aperçu navigateur ----------

const LS = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(`outilo:${key}`)
      return v ? (JSON.parse(v) as T) : fallback
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(`outilo:${key}`, JSON.stringify(value))
    } catch {
      /* stockage indisponible : l'aperçu fonctionne sans persistance */
    }
  }
}

async function previewList(): Promise<ExtList> {
  const res = await fetch('/__dev/extensions.json')
  const list = (await res.json()) as ExtList
  const disabled = LS.get<string[]>('disabled', [])
  const removed = LS.get<string[]>('removed', [])
  list.items = list.items
    .filter((e: ExtInfo) => !removed.includes(e.id))
    .map((e: ExtInfo) => ({ ...e, enabled: !disabled.includes(e.id) }))
  return list
}

function download(name: string, content: string | Uint8Array<ArrayBuffer>) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: typeof content === 'string' ? 'text/plain' : 'application/octet-stream' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

async function preview(cmd: string, a: Record<string, any>): Promise<unknown> {
  switch (cmd) {
    case 'app_info':
      return {
        version: '0.5.0-preview',
        dataDir: 'localStorage',
        extBaseUrl: '/__dev/ext/',
        api: '1',
        registryUrl: '',
        signedUpdates: false
      }
    case 'get_settings':
      return LS.get('settings', {})
    case 'save_settings':
      return LS.set('settings', a.settings)
    case 'list_extensions':
    case 'reload_extensions':
      return previewList()
    case 'restore_official_extensions':
      LS.set('removed', [])
      return previewList()
    case 'list_bundled': {
      const all = (await (await fetch('/__dev/extensions.json')).json()) as ExtList
      return all.items.map(e => ({ id: e.id, name: e.name, description: e.description, categories: e.categories, version: e.version, permissions: e.permissions }))
    }
    case 'choose_extensions': {
      const all = (await (await fetch('/__dev/extensions.json')).json()) as ExtList
      LS.set('removed', all.items.map(e => e.id).filter(id => !a.ids.includes(id)))
      return previewList()
    }
    case 'install_bundled':
      LS.set('removed', LS.get<string[]>('removed', []).filter(id => id !== a.id))
      return previewList()
    case 'set_extension_enabled': {
      const disabled = LS.get<string[]>('disabled', []).filter(d => d !== a.id)
      if (!a.enabled) disabled.push(a.id)
      LS.set('disabled', disabled)
      return previewList()
    }
    case 'ext_storage': {
      const kv = LS.get<Record<string, unknown>>(`kv:${a.id}`, {})
      if (a.op === 'get') return kv[a.key] ?? null
      if (a.op === 'keys') return Object.keys(kv)
      if (a.op === 'set') kv[a.key] = a.value
      if (a.op === 'remove') delete kv[a.key]
      LS.set(`kv:${a.id}`, kv)
      return null
    }
    case 'ext_save_file':
    case 'export_theme':
      download(a.name, a.encoding === 'base64' ? Uint8Array.from(atob(a.content), c => c.charCodeAt(0)) : a.content)
      return true
    case 'list_themes':
      return (await fetch('/__dev/themes.json')).json()
    case 'delete_theme':
    case 'set_shell_options':
      return null
    default:
      throw new UnavailableError(cmd)
  }
}
