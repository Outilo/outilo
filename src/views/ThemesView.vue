<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import { api, inTauri } from '../lib/api'
import { t } from '../lib/i18n'
import { currentTheme, refreshThemes, store, themeState, toast } from '../lib/store'
import { ACCENTS, slug, themeToToml } from '../lib/theme'

const accent = computed(() => themeState.value?.vars['--o-accent'] ?? '#f59e0b')
const radius = computed(() => parseInt(themeState.value?.vars['--o-radius'] ?? '8', 10))

const exportName = computed(() => {
  const base = currentTheme.value?.name ?? 'Mon thème'
  const custom = store.settings.accent || store.settings.radius != null || store.settings.customCss.trim()
  return custom ? `${base} (perso)` : base
})

const toml = computed(() => {
  const s = themeState.value
  if (!s) return ''
  return themeToToml(slug(exportName.value), exportName.value, s.mode, s.vars, s.css.trim())
})

function reset() {
  store.settings.accent = null
  store.settings.radius = null
}

async function importTheme() {
  try {
    const theme = await api.importTheme()
    if (!theme) return
    await refreshThemes()
    store.settings.themeId = theme.id
    toast(t('theme.imported'), 'success')
  } catch (e) {
    toast(String(e), 'error')
  }
}

async function exportTheme() {
  try {
    if (await api.exportTheme(`${slug(exportName.value)}.toml`, toml.value)) toast(t('theme.exported'), 'success')
  } catch (e) {
    toast(String(e), 'error')
  }
}

async function remove(id: string) {
  await api.deleteTheme(id)
  if (store.settings.themeId === id) store.settings.themeId = 'atelier-dark'
  await refreshThemes()
}
</script>

<template>
  <div class="page">
    <h1>{{ t('theme.title') }}</h1>
    <p class="sub">{{ t('theme.sub') }}</p>

    <h6 class="section-title">{{ t('theme.themes') }}</h6>
    <div class="themes">
      <button
        v-for="th in store.themes"
        :key="th.id"
        class="theme"
        :class="{ on: th.id === store.settings.themeId }"
        @click="store.settings.themeId = th.id"
      >
        <span class="pv" :style="{ background: th.colors.bg }">
          <span class="pv-side" :style="{ background: th.colors.surface, borderColor: th.colors.border }" />
          <span class="pv-bar" :style="{ background: th.colors.accent }" />
          <span class="pv-text" :style="{ background: th.colors.text }" />
        </span>
        <span class="name">
          {{ th.name }}
          <small v-if="th.builtin">{{ t('theme.builtin') }}</small>
          <span v-else class="del" :title="t('theme.delete')" @click.stop="remove(th.id)"><Icon name="trash" :size="12" /></span>
        </span>
      </button>
    </div>

    <div class="cols">
      <div class="panel">
        <span class="label">{{ t('theme.accent') }}</span>
        <div class="row">
          <button
            v-for="c in ACCENTS"
            :key="c"
            class="sw"
            :class="{ on: accent.toLowerCase() === c }"
            :style="{ background: c }"
            :title="c"
            @click="store.settings.accent = c"
          />
          <input class="picker" type="color" :value="accent" @input="store.settings.accent = ($event.target as HTMLInputElement).value" />
        </div>

        <span class="label spaced">{{ t('theme.radius') }} : {{ radius }}px</span>
        <input type="range" min="0" max="18" :value="radius" @input="store.settings.radius = +($event.target as HTMLInputElement).value" />

        <div class="row spaced">
          <button class="btn" @click="reset">{{ t('theme.reset') }}</button>
          <button v-if="inTauri" class="btn" @click="importTheme"><Icon name="upload" :size="14" /> {{ t('theme.import') }}</button>
          <button class="btn primary" @click="exportTheme"><Icon name="download" :size="14" /> {{ t('theme.export') }}</button>
        </div>

        <span class="label spaced">{{ t('theme.css') }}</span>
        <textarea v-model="store.settings.customCss" class="textarea" spellcheck="false" placeholder=".tab { font-weight: 600; }" />
        <p class="hint">{{ t('theme.cssHint') }}</p>
      </div>
      <div class="panel">
        <span class="label">{{ t('theme.preview') }}</span>
        <pre class="code">{{ toml }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.themes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
}
.theme {
  border: 2px solid var(--o-border);
  border-radius: 10px;
  background: var(--o-surface);
  color: var(--o-text);
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.theme.on {
  border-color: var(--o-accent);
}
.pv {
  display: block;
  position: relative;
  height: 64px;
}
.pv-side {
  position: absolute;
  inset: 0 70% 0 0;
  border-right: 1px solid;
}
.pv-bar {
  position: absolute;
  left: 38%;
  bottom: 12px;
  width: 34%;
  height: 10px;
  border-radius: 5px;
}
.pv-text {
  position: absolute;
  left: 38%;
  top: 14px;
  width: 46%;
  height: 6px;
  border-radius: 3px;
  opacity: 0.7;
}
.name {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  font-size: 12.5px;
  font-weight: 600;
}
.name small {
  color: var(--o-muted);
  font-weight: 400;
}
.del {
  margin-left: auto;
  color: var(--o-muted);
  display: grid;
}
.del:hover {
  color: var(--o-danger);
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 20px;
}
@media (max-width: 1000px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
.sw {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.sw.on {
  border-color: var(--o-text);
}
.picker {
  width: 34px;
  height: 30px;
  border: 1px solid var(--o-border);
  border-radius: 6px;
  background: none;
  padding: 2px;
  cursor: pointer;
}
input[type='range'] {
  width: 100%;
}
.spaced {
  margin-top: 20px;
}
.hint {
  color: var(--o-muted);
  font-size: 12px;
  margin-top: 6px;
}
</style>
