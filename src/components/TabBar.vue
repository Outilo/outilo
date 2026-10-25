<script setup lang="ts">
import { t } from '../lib/i18n'
import { closeTab, store, tabTitle } from '../lib/store'
import Icon from './Icon.vue'

function onAuxClick(e: MouseEvent, key: string) {
  if (e.button === 1) closeTab(key)
}
</script>

<template>
  <div class="tabs" role="tablist">
    <div
      v-for="tab in store.tabs"
      :key="tab.key"
      class="tab"
      role="tab"
      :aria-selected="store.active === tab.key"
      :class="{ on: store.active === tab.key }"
      @click="store.active = tab.key"
      @auxclick="onAuxClick($event, tab.key)"
    >
      <span>{{ tabTitle(tab) }}</span>
      <button v-if="tab.key !== 'page:home'" class="x" :title="t('tab.close')" @click.stop="closeTab(tab.key)">
        <Icon name="close" :size="12" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  height: 36px;
  background: var(--o-surface);
  border-bottom: 1px solid var(--o-border);
  overflow-x: auto;
  scrollbar-width: none;
}
.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 14px;
  font-size: 12px;
  color: var(--o-muted);
  border-right: 1px solid var(--o-border);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
.tab:hover {
  color: var(--o-text);
}
.tab.on {
  background: var(--o-bg);
  color: var(--o-text);
  box-shadow: inset 0 2px 0 var(--o-accent);
}
.x {
  border: 0;
  background: none;
  color: inherit;
  opacity: 0.5;
  padding: 2px;
  border-radius: 4px;
  display: grid;
  cursor: pointer;
}
.x:hover {
  opacity: 1;
  background: var(--o-surface-2);
}
</style>
