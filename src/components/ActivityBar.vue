<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../lib/i18n'
import { currentTheme, openPage, store, toggleMode, toggleSidebar, updates } from '../lib/store'
import Icon from './Icon.vue'

const activePage = computed(() => (store.active.startsWith('page:') ? store.active.slice(5) : null))
</script>

<template>
  <nav class="activity">
    <button :class="{ on: activePage === 'home' }" :title="t('act.home')" @click="openPage('home')">
      <Icon name="home" :size="20" />
    </button>
    <button :class="{ on: store.sidebarOpen }" :title="`${t('act.explorer')} (Ctrl B)`" @click="toggleSidebar()">
      <Icon name="explorer" :size="20" />
    </button>
    <button :class="{ on: activePage === 'extensions' }" :title="t('act.extensions')" @click="openPage('extensions')">
      <Icon name="extensions" :size="20" />
      <span v-if="updates.length" class="badge">{{ updates.length }}</span>
    </button>
    <button :class="{ on: activePage === 'themes' }" :title="t('act.themes')" @click="openPage('themes')">
      <Icon name="themes" :size="20" />
    </button>
    <div class="spacer" />
    <button :title="t('act.mode')" @click="toggleMode()">
      <Icon :name="currentTheme?.mode === 'dark' ? 'sun' : 'moon'" :size="20" />
    </button>
    <button :class="{ on: activePage === 'settings' }" :title="`${t('act.settings')} (Ctrl ,)`" @click="openPage('settings')">
      <Icon name="settings" :size="20" />
    </button>
  </nav>
</template>

<style scoped>
.activity {
  width: 48px;
  background: var(--o-surface);
  border-right: 1px solid var(--o-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 4px;
}
button {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--o-muted);
  cursor: pointer;
  position: relative;
  border: 0;
  background: none;
}
button:hover {
  color: var(--o-text);
  background: var(--o-surface-2);
}
button.on {
  color: var(--o-accent);
}
button.on::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: var(--o-accent);
  border-radius: 2px;
}
.spacer {
  flex: 1;
}
.badge {
  position: absolute;
  right: 2px;
  bottom: 2px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--o-accent);
  color: var(--o-accent-ink);
  font-size: 10px;
  font-weight: 600;
  line-height: 15px;
}
</style>
