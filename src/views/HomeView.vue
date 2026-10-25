<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import ToolIcon from '../components/ToolIcon.vue'
import { loc, t } from '../lib/i18n'
import { enabledExtensions, openPage, openTool, store } from '../lib/store'
import type { ExtInfo } from '../lib/types'

const recent = computed(() =>
  store.settings.recent.map(id => enabledExtensions.value.find(e => e.id === id)).filter((e): e is ExtInfo => !!e)
)
</script>

<template>
  <div class="page">
    <h1>{{ t('home.hello') }}</h1>
    <p class="sub">{{ t('home.summary', { tools: enabledExtensions.length, fav: store.settings.favorites.length }) }}</p>

    <div v-if="store.warnings.length" class="panel warnings">
      <span class="label"><Icon name="warning" :size="13" /> {{ t('home.warnings') }}</span>
      <p v-for="w in store.warnings" :key="w">{{ w }}</p>
    </div>

    <template v-if="recent.length">
      <h6 class="section-title">{{ t('home.recent') }}</h6>
      <div class="row">
        <button v-for="ext in recent" :key="`r-${ext.id}`" class="btn" @click="openTool(ext.id)">
          <ToolIcon :ext="ext" :size="18" /> {{ loc(ext.name) }}
        </button>
      </div>
    </template>

    <h6 class="section-title">{{ t('home.tools') }}</h6>
    <div v-if="enabledExtensions.length" class="grid">
      <div v-for="ext in enabledExtensions" :key="ext.id" class="panel card" @click="openTool(ext.id)">
        <ToolIcon :ext="ext" :size="40" />
        <div>
          <strong>{{ loc(ext.name) }}</strong>
          <p>{{ loc(ext.description) }}</p>
        </div>
      </div>
    </div>
    <div v-else class="panel empty">
      <p>{{ t('home.noTools') }}</p>
      <button class="btn primary" @click="openPage('extensions')">{{ t('home.add') }}</button>
    </div>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  gap: 12px;
  align-items: center;
  cursor: pointer;
  transition: border-color 0.15s;
}
.card:hover {
  border-color: var(--o-accent);
}
.card strong {
  font-size: 14px;
}
.card p {
  font-size: 12.5px;
  color: var(--o-muted);
  line-height: 1.5;
  margin-top: 2px;
}
.card :deep(.tool-icon) {
  border-radius: 10px;
  font-size: 13px;
}
.warnings {
  margin-top: 20px;
  border-color: color-mix(in srgb, var(--o-danger) 45%, var(--o-border));
}
.warnings .label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--o-danger);
}
.warnings p {
  font-family: var(--o-font-mono);
  font-size: 12px;
  color: var(--o-muted);
}
.empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--o-muted);
}
</style>
