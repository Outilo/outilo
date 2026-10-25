<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { locale, t } from '../lib/i18n'
import { enabledExtensions, store } from '../lib/store'

const online = ref(navigator.onLine)
const update = () => (online.value = navigator.onLine)
onMounted(() => {
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', update)
  window.removeEventListener('offline', update)
})

const lang = computed(() => locale.value.toUpperCase())
const toggleLang = () => (locale.value = locale.value === 'fr' ? 'en' : 'fr')
const devCount = computed(() => store.extensions.filter(e => e.source === 'dev').length)
</script>

<template>
  <footer class="status">
    <span>● {{ online ? t('status.online') : t('status.offline') }}</span>
    <span>{{ t('status.extensions', { n: enabledExtensions.length }) }}</span>
    <span v-if="devCount">{{ t('status.dev', { n: devCount }) }}</span>
    <span class="spacer" />
    <button :title="t('status.lang')" @click="toggleLang">{{ lang }}</button>
    <span>v{{ store.info?.version }}</span>
  </footer>
</template>

<style scoped>
.status {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 26px;
  padding: 0 12px;
  background: var(--o-accent);
  color: var(--o-accent-ink);
  font-size: 11px;
  font-weight: 500;
}
.spacer {
  flex: 1;
}
button {
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  padding: 0 4px;
  border-radius: 3px;
}
button:hover {
  background: rgba(0, 0, 0, 0.12);
}
</style>
