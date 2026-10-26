<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { api, inTauri } from '../lib/api'
import { loc, locale, t } from '../lib/i18n'
import {
  checkAppUpdate,
  checkUpdates,
  enabledExtensions,
  openPage,
  openTool,
  reloadActiveTab,
  setExtensions,
  store,
  toast,
  toggleMode,
  toggleSidebar
} from '../lib/store'
import ToolIcon from './ToolIcon.vue'
import Icon from './Icon.vue'
import type { ExtInfo } from '../lib/types'

interface Item {
  group: string
  label: string
  hint?: string
  ext?: ExtInfo
  icon?: string
  run: () => void
}

const query = ref('')
const selected = ref(0)
const input = ref<HTMLInputElement | null>(null)

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const items = computed<Item[]>(() => {
  const list: Item[] = []
  for (const ext of enabledExtensions.value) {
    list.push({ group: t('pal.tools'), label: loc(ext.name), hint: loc(ext.description), ext, run: () => openTool(ext.id) })
  }
  for (const ext of enabledExtensions.value) {
    for (const cmd of ext.commands) {
      list.push({ group: t('pal.commands'), label: loc(cmd.title), hint: loc(ext.name), ext, run: () => openTool(ext.id, cmd.id) })
    }
  }
  const app: Item[] = [
    { group: t('pal.app'), label: t('page.home'), icon: 'home', run: () => openPage('home') },
    { group: t('pal.app'), label: t('page.extensions'), icon: 'extensions', run: () => openPage('extensions') },
    { group: t('pal.app'), label: t('page.themes'), icon: 'themes', run: () => openPage('themes') },
    { group: t('pal.app'), label: t('page.settings'), icon: 'settings', run: () => openPage('settings') },
    { group: t('pal.app'), label: t('pal.toggleMode'), icon: 'moon', run: toggleMode },
    { group: t('pal.app'), label: t('pal.switchLang'), icon: 'command', run: () => (locale.value = locale.value === 'fr' ? 'en' : 'fr') },
    { group: t('pal.app'), label: t('pal.sidebar'), icon: 'explorer', run: toggleSidebar },
    { group: t('pal.app'), label: t('pal.reloadTab'), icon: 'reload', run: reloadActiveTab },
    {
      group: t('pal.app'),
      label: t('pal.reload'),
      icon: 'reload',
      run: async () => {
        setExtensions(await api.reloadExtensions())
        toast(t('ext.reloaded'), 'success')
      }
    }
  ]
  if (inTauri) app.push({ group: t('pal.app'), label: t('pal.checkUpdates'), icon: 'download', run: () => checkUpdates(true) })
  if (inTauri) app.push({ group: t('pal.app'), label: t('app.checkApp'), icon: 'download', run: () => checkAppUpdate(true) })
  list.push(...app)
  const q = normalize(query.value.trim())
  if (!q) return list
  return list.filter(i => normalize(`${i.label} ${i.hint ?? ''} ${i.group}`).includes(q))
})

watch(
  () => store.paletteOpen,
  async open => {
    if (!open) return
    query.value = ''
    selected.value = 0
    await nextTick()
    // Ouverte depuis un cadre d'extension : il faut d'abord reprendre le focus au cadre
    ;(document.activeElement as HTMLElement | null)?.blur()
    window.focus()
    input.value?.focus()
  }
)
watch(query, () => (selected.value = 0))

function run(item: Item | undefined) {
  if (!item) return
  store.paletteOpen = false
  item.run()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    selected.value = Math.min(selected.value + 1, items.value.length - 1)
    e.preventDefault()
  } else if (e.key === 'ArrowUp') {
    selected.value = Math.max(selected.value - 1, 0)
    e.preventDefault()
  } else if (e.key === 'Enter') {
    run(items.value[selected.value])
  } else if (e.key === 'Escape') {
    store.paletteOpen = false
  }
}

watch(selected, async () => {
  await nextTick()
  document.querySelector('.palette .it.sel')?.scrollIntoView({ block: 'nearest' })
})

const showGroup = (i: number) => i === 0 || items.value[i - 1].group !== items.value[i].group
</script>

<template>
  <div v-if="store.paletteOpen" class="overlay" @mousedown.self="store.paletteOpen = false">
    <div class="palette" role="dialog">
      <div class="bar">
        <Icon name="search" :size="16" />
        <input ref="input" v-model="query" :placeholder="t('pal.placeholder')" @keydown="onKey" />
        <kbd>Esc</kbd>
      </div>
      <div class="list">
        <template v-for="(item, i) in items" :key="`${item.group}-${item.label}-${i}`">
          <div v-if="showGroup(i)" class="grp">{{ item.group }}</div>
          <div class="it" :class="{ sel: i === selected }" @mousemove="selected = i" @click="run(item)">
            <ToolIcon v-if="item.ext" :ext="item.ext" />
            <span v-else class="ic"><Icon :name="item.icon ?? 'command'" :size="14" /></span>
            <span class="label">{{ item.label }}</span>
            <span class="hint">{{ item.hint }}</span>
          </div>
        </template>
        <div v-if="!items.length" class="empty">{{ t('pal.empty') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 80px;
  z-index: 50;
}
.palette {
  width: min(620px, calc(100vw - 32px));
  max-height: min(460px, calc(100vh - 120px));
  display: flex;
  flex-direction: column;
  background: var(--o-surface);
  border: 1px solid var(--o-border);
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}
.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  height: 48px;
  border-bottom: 1px solid var(--o-border);
  color: var(--o-muted);
}
.bar input {
  flex: 1;
  border: 0;
  outline: 0;
  background: none;
  color: var(--o-text);
  font: inherit;
  font-size: 15px;
}
.list {
  overflow: auto;
  padding: 6px;
}
.grp {
  font-size: 11px;
  font-weight: 600;
  color: var(--o-muted);
  padding: 10px 10px 4px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.it {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13.5px;
}
.it.sel {
  background: var(--o-surface-2);
}
.ic {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: var(--o-surface-2);
  color: var(--o-muted);
}
.it.sel .ic {
  color: var(--o-accent);
}
.hint {
  margin-left: auto;
  color: var(--o-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 45%;
}
.empty {
  padding: 24px;
  text-align: center;
  color: var(--o-muted);
}
</style>
