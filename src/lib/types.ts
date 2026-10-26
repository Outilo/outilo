export type Locale = 'fr' | 'en'
export type Localized = string | Record<string, string>

export interface AppInfo {
  version: string
  dataDir: string
  extBaseUrl: string
  api: string
  registryUrl: string
  signedUpdates: boolean
}

export interface ExtCommand {
  id: string
  title: Localized
}

export interface ExtInfo {
  id: string
  name: Localized
  description?: Localized | null
  version: string
  authors: string[]
  categories: string[]
  entry: string
  icon?: string | null
  commands: ExtCommand[]
  permissions: string[]
  sensitive: string[]
  hosts: string[]
  previous?: string | null
  source: 'official' | 'dev' | 'local'
  enabled: boolean
  path: string
}

export interface ExtList {
  items: ExtInfo[]
  warnings: string[]
}

/** Extension du registre en ligne, comparée à la version installée. */
export interface Available {
  id: string
  name: Localized
  description?: Localized | null
  categories: string[]
  authors?: string[]
  verified?: boolean
  version: string
  installed?: string | null
  update: boolean
  permissions: string[]
  newPermissions: string[]
  skipped: boolean
  size: number
}

/** Extension du pack embarqué (catalogue hors ligne). */
export interface BundledInfo {
  id: string
  name: Localized
  description?: Localized | null
  categories: string[]
  version: string
  permissions: string[]
}

export interface AppUpdate {
  current: string
  latest: string
  available: boolean
  notes: string
  size: number
}

export interface CheckResult {
  items: Available[]
  packs: Record<string, string[]>
  generated: string
  offline?: string | null
}

export interface ThemeDef {
  id: string
  name: string
  mode: 'dark' | 'light'
  colors: Record<string, string>
  radius?: string | null
  fontUi?: string | null
  fontMono?: string | null
  css?: string | null
  builtin: boolean
}

export interface ThemeList {
  themes: ThemeDef[]
  warnings: string[]
}

export interface Settings {
  locale: Locale
  onboarded: boolean
  profiles: string[]
  themeId: string
  accent: string | null
  radius: number | null
  customCss: string
  favorites: string[]
  recent: string[]
  devMode: boolean
  sidebar: boolean
  autoUpdate: boolean
  closeToTray: boolean
  globalShortcut: boolean
  appAutoUpdate: boolean
  /** Bac à sable : les actions système des extensions en développement sont simulées. */
  devSimulate: boolean
  /** Version dont la notification a été fermée (« Plus tard »). */
  appUpdateDismissed: string
}

export type Page = 'home' | 'extensions' | 'themes' | 'settings'

export type Tab =
  | { key: string; kind: 'page'; page: Page }
  | { key: string; kind: 'ext'; extId: string; reload: number }

/** Journal des appels d'API des extensions en développement. */
export interface DevCall {
  time: number
  extId: string
  method: string
  ms: number
  error?: string
  simulated?: boolean
}

export interface Toast {
  id: number
  message: string
  type: 'info' | 'success' | 'error'
}
