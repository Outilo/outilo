<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'
import { inTauri } from '../lib/api'
import { t } from '../lib/i18n'
import { store } from '../lib/store'
import Icon from './Icon.vue'

const win = inTauri ? getCurrentWindow() : null
</script>

<template>
  <header class="titlebar" data-tauri-drag-region>
    <div class="brand" data-tauri-drag-region>
      <span class="mark">O</span>
      <strong>Outilo</strong>
    </div>
    <button class="cmd" @click="store.paletteOpen = true">
      <Icon name="search" :size="14" />
      <span>{{ t('app.search') }}</span>
      <kbd>Ctrl K</kbd>
    </button>
    <div class="controls" v-if="win">
      <button :title="t('win.minimize')" @click="win.minimize()"><Icon name="minimize" :size="14" /></button>
      <button :title="t('win.maximize')" @click="win.toggleMaximize()"><Icon name="maximize" :size="12" /></button>
      <button class="close" :title="t('win.close')" @click="win.close()"><Icon name="close" :size="14" /></button>
    </div>
    <span v-else class="preview">{{ store.info?.version }}</span>
  </header>
</template>

<style scoped>
.titlebar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 36px;
  background: var(--o-surface);
  border-bottom: 1px solid var(--o-border);
  font-size: 12px;
  color: var(--o-muted);
  user-select: none;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
  color: var(--o-text);
}
.mark {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  display: grid;
  place-items: center;
  background: var(--o-accent);
  color: var(--o-accent-ink);
  font-family: var(--o-font-mono);
  font-size: 11px;
  font-weight: 500;
}
.cmd {
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(440px, 46vw);
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--o-border);
  border-radius: 6px;
  background: var(--o-bg);
  color: var(--o-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.cmd:hover {
  border-color: var(--o-muted);
}
.cmd kbd {
  margin-left: auto;
}
.controls {
  justify-self: end;
  display: flex;
  height: 100%;
}
.controls button {
  width: 46px;
  height: 100%;
  border: 0;
  background: none;
  color: var(--o-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.controls button:hover {
  background: var(--o-surface-2);
  color: var(--o-text);
}
.controls .close:hover {
  background: #e81123;
  color: #fff;
}
.preview {
  justify-self: end;
  padding-right: 12px;
}
</style>
