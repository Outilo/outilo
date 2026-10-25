import type { ThemeDef } from './types'

export const ACCENTS = ['#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981']

const TOKENS = ['bg', 'surface', 'surface-2', 'border', 'text', 'muted', 'accent', 'accent-ink', 'success', 'danger']

export interface ThemeOverrides {
  accent: string | null
  radius: number | null
}

/** Variables CSS `--o-*` d'un thème, complété par le thème intégré du même mode. */
export function themeVars(theme: ThemeDef, base: ThemeDef | undefined, o: ThemeOverrides): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const token of TOKENS) {
    const v = theme.colors[token] ?? base?.colors[token]
    if (v) vars[`--o-${token}`] = v
  }
  if (o.accent) {
    vars['--o-accent'] = o.accent
    vars['--o-accent-ink'] = inkFor(o.accent)
  }
  vars['--o-radius'] = o.radius != null ? `${o.radius}px` : (theme.radius ?? base?.radius ?? '8px')
  vars['--o-font-ui'] = theme.fontUi ?? base?.fontUi ?? "'Inter Variable', system-ui, sans-serif"
  vars['--o-font-mono'] = theme.fontMono ?? base?.fontMono ?? "'JetBrains Mono', ui-monospace, monospace"
  return vars
}

/** Texte lisible (noir ou blanc) sur une couleur d'accent `#rrggbb`. */
export function inkFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.4 ? '#1a1204' : '#ffffff'
}

let customStyle: HTMLStyleElement | null = null

export function applyShellTheme(vars: Record<string, string>, mode: 'dark' | 'light', css: string) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  root.dataset.mode = mode
  root.style.colorScheme = mode
  if (!customStyle) {
    customStyle = document.createElement('style')
    customStyle.id = 'outilo-custom-css'
    document.head.appendChild(customStyle)
  }
  customStyle.textContent = css
}

/** Sérialise le thème effectif (réglages compris) au format theme.toml. */
export function themeToToml(id: string, name: string, mode: string, vars: Record<string, string>, css: string): string {
  const q = (s: string) => JSON.stringify(s)
  const lines = ['[meta]', `id = ${q(id)}`, `name = ${q(name)}`, `mode = ${q(mode)}`, '', '[colors]']
  for (const token of TOKENS) if (vars[`--o-${token}`]) lines.push(`${token} = ${q(vars[`--o-${token}`])}`)
  lines.push('', '[shape]', `radius = ${q(vars['--o-radius'])}`, '', '[font]')
  lines.push(`ui = ${q(vars['--o-font-ui'])}`, `mono = ${q(vars['--o-font-mono'])}`)
  // Une chaîne JSON est aussi une chaîne TOML valide (mêmes échappements)
  if (css.trim()) lines.push('', '[css]', `code = ${q(css)}`)
  return lines.join('\n') + '\n'
}

export function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'mon-theme'
  )
}
