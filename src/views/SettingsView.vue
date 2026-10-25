<script setup lang="ts">
import { computed } from 'vue'
import { inTauri } from '../lib/api'
import { locale, t } from '../lib/i18n'
import { store } from '../lib/store'

const shortcuts = [
  ['Ctrl K', 'key.palette'],
  ['Ctrl W', 'key.close'],
  ['Ctrl Tab', 'key.next'],
  ['Ctrl B', 'key.sidebar'],
  ['Ctrl ,', 'key.settings']
]
const allShortcuts = computed(() =>
  store.settings.globalShortcut ? [...shortcuts, ['Alt Maj Espace', 'key.global']] : shortcuts
)

const setLocale = (l: string) => (locale.value = l === 'en' ? 'en' : 'fr')
</script>

<template>
  <div class="page">
    <h1>{{ t('set.title') }}</h1>

    <div class="stack">
      <div class="panel">
        <span class="label">{{ t('set.language') }}</span>
        <select class="select" :value="locale" @change="setLocale(($event.target as HTMLSelectElement).value)">
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>

      <div class="panel">
        <span class="label">{{ t('set.appearance') }}</span>
        <label class="switch"><input v-model="store.settings.sidebar" type="checkbox" /> {{ t('set.sidebar') }}</label>
      </div>

      <div v-if="inTauri" class="panel">
        <span class="label">{{ t('set.window') }}</span>
        <div class="col">
          <label class="switch"><input v-model="store.settings.closeToTray" type="checkbox" /> {{ t('set.closeToTray') }}</label>
          <label class="switch">
            <input v-model="store.settings.globalShortcut" type="checkbox" /> {{ t('set.globalShortcut') }}
          </label>
        </div>
      </div>

      <div class="panel">
        <span class="label">{{ t('set.updates') }}</span>
        <label class="switch"><input v-model="store.settings.autoUpdate" type="checkbox" /> {{ t('set.autoUpdate') }}</label>
      </div>

      <div class="panel">
        <span class="label">{{ t('set.profile') }}</span>
        <p class="hint">{{ t('set.profileHint') }}</p>
        <div class="row">
          <span v-for="p in store.settings.profiles" :key="p" class="chip acc">{{ t(`prof.${p}`) }}</span>
          <button class="btn sm" @click="store.settings.onboarded = false">{{ t('set.redoOnboarding') }}</button>
        </div>
      </div>

      <div class="panel">
        <span class="label">{{ t('set.dev') }}</span>
        <label class="switch"><input v-model="store.settings.devMode" type="checkbox" /> {{ t('set.devHint') }}</label>
      </div>

      <div class="panel">
        <span class="label">{{ t('set.shortcuts') }}</span>
        <table>
          <tbody>
            <tr v-for="[keys, label] in allShortcuts" :key="keys">
              <td><kbd>{{ keys }}</kbd></td>
              <td>{{ t(label) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="panel">
        <span class="label">{{ t('set.about') }}</span>
        <table>
          <tbody>
            <tr><td>{{ t('set.version') }}</td><td class="mono">{{ store.info?.version }}</td></tr>
            <tr><td>{{ t('set.api') }}</td><td class="mono">v{{ store.info?.api }}</td></tr>
            <tr><td>{{ t('set.data') }}</td><td class="mono">{{ store.info?.dataDir }}</td></tr>
            <tr v-if="store.info?.registryUrl"><td>{{ t('set.registry') }}</td><td class="mono">{{ store.info.registryUrl }}</td></tr>
            <tr><td>Licence</td><td class="mono">Apache-2.0</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
  max-width: 760px;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hint {
  color: var(--o-muted);
  font-size: 12.5px;
  margin-bottom: 10px;
}
table {
  border-collapse: collapse;
  font-size: 13px;
}
td {
  padding: 5px 24px 5px 0;
}
.mono {
  font-family: var(--o-font-mono);
  font-size: 12px;
  color: var(--o-muted);
  word-break: break-all;
}
</style>
