import { computed, reactive, watch } from 'vue'
import { api, inTauri } from './api'
import { locale, loc, t } from './i18n'
import { applyShellTheme, themeVars } from './theme'
import type { AppInfo, AppUpdate, Available, BundledInfo, DevCall, ExtInfo, ExtList, Page, Settings, Tab, ThemeDef, Toast } from './types'
import { broadcast, sendCommand } from './extHost'

const DEFAULT_SETTINGS: Settings = {
  locale: 'fr',
  onboarded: false,
  profiles: [],
  themeId: 'atelier-dark',
  accent: null,
  radius: null,
  customCss: '',
  favorites: [],
  recent: [],
  devMode: false,
  sidebar: true,
  autoUpdate: true,
  closeToTray: false,
  globalShortcut: false,
  appAutoUpdate: false,
  devSimulate: true,
  appUpdateDismissed: ''
}

/** Raccourci système qui affiche / masque Outilo. */
export const GLOBAL_SHORTCUT = 'Alt+Shift+Space'

const CHECK_INTERVAL = 24 * 60 * 60 * 1000

export const store = reactive({
  ready: false,
  info: null as AppInfo | null,
  settings: { ...DEFAULT_SETTINGS } as Settings,
  extensions: [] as ExtInfo[],
  warnings: [] as string[],
  themes: [] as ThemeDef[],
  /** Pack embarqué : catalogue hors ligne. */
  bundled: [] as BundledInfo[],
  tabs: [{ key: 'page:home', kind: 'page', page: 'home' }] as Tab[],
  active: 'page:home',
  paletteOpen: false,
  sidebarOpen: true,
  toasts: [] as Toast[],
  /** Nouvelle version de l'application, si elle existe. */
  appUpdate: null as AppUpdate | null,
  appUpdating: false,
  devLog: [] as DevCall[],
  registry: {
    items: [] as Available[],
    packs: {} as Record<string, string[]>,
    checking: false,
    checkedAt: 0,
    error: '',
    offline: '',
    installing: [] as string[]
  }
})

/** Mises à jour proposées (hors versions écartées par un retour arrière). */
export const updates = computed(() => store.registry.items.filter(i => i.update && !i.skipped))

export const enabledExtensions = computed(() =>
  store.extensions.filter(e => e.enabled).sort((a, b) => loc(a.name).localeCompare(loc(b.name)))
)

export const currentTheme = computed(
  () => store.themes.find(t => t.id === store.settings.themeId) ?? store.themes.find(t => t.id === 'atelier-dark')
)

export const themeState = computed(() => {
  const theme = currentTheme.value
  if (!theme) return null
  const base = store.themes.find(t => t.builtin && t.mode === theme.mode)
  const vars = themeVars(theme, base, { accent: store.settings.accent, radius: store.settings.radius })
  return { vars, mode: theme.mode, css: [theme.css ?? '', store.settings.customCss].join('\n') }
})

// ---------- Initialisation & persistance ----------

export async function init() {
  const [info, saved, list, themes] = await Promise.all([
    api.appInfo(),
    api.getSettings(),
    api.listExtensions(),
    api.listThemes()
  ])
  store.info = info
  store.settings = { ...DEFAULT_SETTINGS, ...(saved as Partial<Settings>) }
  store.sidebarOpen = store.settings.sidebar
  locale.value = store.settings.locale
  store.themes = themes.themes
  store.bundled = await api.listBundled().catch(() => [])
  setExtensions(list, themes.warnings)
  store.ready = true

  watch(
    () => store.settings,
    () => scheduleSave(),
    { deep: true }
  )
  watch(
    themeState,
    s => {
      if (!s) return
      applyShellTheme(s.vars, s.mode, s.css)
      broadcast({ kind: 'theme', vars: s.vars, mode: s.mode })
    },
    { immediate: true }
  )
  watch(locale, l => {
    store.settings.locale = l
    broadcast({ kind: 'locale', locale: l })
  })
  watch(
    () => [store.settings.closeToTray, store.settings.globalShortcut, store.settings.locale] as const,
    ([closeToTray, shortcut, l]) => {
      api
        .setShellOptions({ closeToTray, shortcut: shortcut ? GLOBAL_SHORTCUT : null, locale: l })
        .catch(e => toast(String(e), 'error'))
    },
    { immediate: true }
  )

  // Bac à sable : rechargement à chaud des extensions en développement
  watch(
    () => store.settings.devMode,
    on => (on ? startDevWatch() : stopDevWatch()),
    { immediate: true }
  )

  // Registre : au lancement puis toutes les 24 h
  if (inTauri) {
    checkAppUpdate()
    checkUpdates()
    window.setInterval(checkUpdates, CHECK_INTERVAL)
  }
}

// ---------- Bac à sable développeur ----------

let devTimer: number | undefined
let lastPrint: Record<string, string> = {}

function startDevWatch() {
  if (!inTauri || devTimer) return
  lastPrint = {}
  // Le réglage est enregistré avec un léger délai : on laisse le cœur le relire avant de recharger
  window.setTimeout(async () => setExtensions(await api.reloadExtensions()), 600)
  devTimer = window.setInterval(async () => {
    let print: Record<string, string>
    try {
      print = await api.devFingerprint()
    } catch {
      return
    }
    const first = !Object.keys(lastPrint).length
    const changed = Object.keys(print).filter(k => lastPrint[k] !== print[k])
    lastPrint = print
    if (first || !changed.length) return
    setExtensions(await api.reloadExtensions())
    for (const tab of store.tabs) if (tab.kind === 'ext' && changed.includes(tab.extId)) tab.reload++
    const names = changed.filter(k => k !== '__links')
    if (names.length) toast(t('dev.reloaded', { n: names.length }), 'info')
  }, 1500)
}

function stopDevWatch() {
  clearInterval(devTimer)
  devTimer = undefined
}

export function logDevCall(call: DevCall) {
  store.devLog.unshift(call)
  if (store.devLog.length > 200) store.devLog.length = 200
}

// ---------- Mise à jour de l'application ----------

export async function checkAppUpdate(manual = false) {
  try {
    const info = await api.appUpdateCheck()
    store.appUpdate = info.available ? info : null
    if (manual) toast(info.available ? t('app.updateFound', { v: info.latest }) : t('app.upToDate', { v: info.current }), 'success')
    if (info.available && store.settings.appAutoUpdate) await installAppUpdate()
  } catch (e) {
    if (manual) toast(String(e), 'error')
  }
}

/** L'installateur est lancé puis Outilo se ferme ; il est relancé une fois à jour. */
export async function installAppUpdate() {
  store.appUpdating = true
  try {
    await api.appUpdateInstall()
  } catch (e) {
    store.appUpdating = false
    toast(String(e), 'error')
  }
}

export function dismissAppUpdate() {
  if (store.appUpdate) store.settings.appUpdateDismissed = store.appUpdate.latest
}

// ---------- Registre en ligne ----------

export async function checkUpdates(manual = false) {
  if (store.registry.checking) return
  store.registry.checking = true
  store.registry.error = ''
  try {
    const result = await api.registryCheck()
    store.registry.items = result.items
    store.registry.packs = result.packs
    store.registry.offline = result.offline ?? ''
    store.registry.checkedAt = Date.now()
    if (manual) toast(updates.value.length ? t('upd.found', { n: updates.value.length }) : t('upd.none'), 'success')
    // Mise à jour automatique, sauf si de nouvelles permissions doivent être acceptées
    if (store.settings.autoUpdate && store.info?.signedUpdates) {
      for (const item of updates.value.filter(u => !u.newPermissions.length)) await installFromRegistry(item.id, true)
    }
  } catch (e) {
    store.registry.error = String(e)
    if (manual) toast(String(e), 'error')
  } finally {
    store.registry.checking = false
  }
}

export async function installFromRegistry(id: string, silent = false) {
  if (store.registry.installing.includes(id)) return
  store.registry.installing.push(id)
  const item = store.registry.items.find(i => i.id === id)
  try {
    setExtensions(await api.registryInstall(id))
    if (item) {
      item.installed = item.version
      item.update = false
      item.newPermissions = []
      toast(t(silent ? 'upd.auto' : 'upd.installed', { name: loc(item.name), v: item.version }), 'success')
    }
    for (const tab of store.tabs) if (tab.kind === 'ext' && tab.extId === id) tab.reload++
  } catch (e) {
    toast(`${item ? loc(item.name) : id} : ${e}`, 'error')
  } finally {
    store.registry.installing = store.registry.installing.filter(x => x !== id)
  }
}

export async function rollbackExtension(id: string) {
  try {
    setExtensions(await api.registryRollback(id))
    for (const tab of store.tabs) if (tab.kind === 'ext' && tab.extId === id) tab.reload++
    const ext = store.extensions.find(e => e.id === id)
    toast(t('upd.rolledBack', { name: ext ? loc(ext.name) : id, v: ext?.version ?? '' }), 'success')
    if (inTauri) checkUpdates()
  } catch (e) {
    toast(String(e), 'error')
  }
}

let saveTimer: number | undefined
function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    api.saveSettings(JSON.parse(JSON.stringify(store.settings))).catch(e => toast(String(e), 'error'))
  }, 300)
}

export function setExtensions(list: ExtList, extraWarnings: string[] = []) {
  store.extensions = list.items
  store.warnings = [...list.warnings, ...extraWarnings]
  // Ferme les onglets d'extensions disparues ou désactivées
  const alive = new Set(list.items.filter(e => e.enabled).map(e => e.id))
  for (const tab of [...store.tabs]) if (tab.kind === 'ext' && !alive.has(tab.extId)) closeTab(tab.key)
}

export async function refreshThemes() {
  const list = await api.listThemes()
  store.themes = list.themes
}

// ---------- Onglets ----------

export function openPage(page: Page) {
  const key = `page:${page}`
  if (!store.tabs.some(t => t.key === key)) store.tabs.push({ key, kind: 'page', page })
  store.active = key
}

export function openTool(extId: string, command?: string) {
  const ext = store.extensions.find(e => e.id === extId && e.enabled)
  if (!ext) return
  const key = `ext:${extId}`
  if (!store.tabs.some(t => t.key === key)) store.tabs.push({ key, kind: 'ext', extId, reload: 0 })
  store.active = key
  store.settings.recent = [extId, ...store.settings.recent.filter(r => r !== extId)].slice(0, 8)
  if (command) sendCommand(key, command)
}

export function closeTab(key: string) {
  if (key === 'page:home') return
  const i = store.tabs.findIndex(t => t.key === key)
  if (i < 0) return
  store.tabs.splice(i, 1)
  if (store.active === key) store.active = store.tabs[Math.max(0, i - 1)].key
}

export function cycleTab(delta: number) {
  const i = store.tabs.findIndex(t => t.key === store.active)
  store.active = store.tabs[(i + delta + store.tabs.length) % store.tabs.length].key
}

export function reloadActiveTab() {
  const tab = store.tabs.find(t => t.key === store.active)
  if (tab?.kind === 'ext') tab.reload++
}

export function tabTitle(tab: Tab): string {
  if (tab.kind === 'page') return t(`page.${tab.page}`)
  const ext = store.extensions.find(e => e.id === tab.extId)
  return ext ? loc(ext.name) : tab.extId
}

// ---------- Divers ----------

export function toggleFavorite(id: string) {
  const fav = store.settings.favorites
  store.settings.favorites = fav.includes(id) ? fav.filter(f => f !== id) : [...fav, id]
}

export function toggleMode() {
  const mode = currentTheme.value?.mode === 'dark' ? 'light' : 'dark'
  store.settings.themeId = mode === 'dark' ? 'atelier-dark' : 'atelier-light'
}

export function toggleSidebar() {
  store.sidebarOpen = !store.sidebarOpen
}

let toastSeq = 0
export function toast(message: string, type: Toast['type'] = 'info') {
  const id = ++toastSeq
  store.toasts.push({ id, message, type })
  window.setTimeout(() => {
    const i = store.toasts.findIndex(x => x.id === id)
    if (i >= 0) store.toasts.splice(i, 1)
  }, type === 'error' ? 5000 : 2200)
}

/** Raccourcis clavier communs au shell et aux cadres d'extension. */
export function handleShortcut(key: string, shift = false): boolean {
  switch (key) {
    case 'k':
    case 'p':
      store.paletteOpen = !store.paletteOpen
      return true
    case 'w':
      closeTab(store.active)
      return true
    case 'tab':
      cycleTab(shift ? -1 : 1)
      return true
    case ',':
      openPage('settings')
      return true
    case 'b':
      toggleSidebar()
      return true
  }
  return false
}
