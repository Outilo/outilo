<script setup lang="ts">
import { computed } from 'vue'
import { category, loc, t } from '../lib/i18n'
import { enabledExtensions, openTool, store, toggleFavorite } from '../lib/store'
import type { ExtInfo } from '../lib/types'
import Icon from './Icon.vue'
import ToolIcon from './ToolIcon.vue'

/** Une extension apparaît sous sa première catégorie. */
const groups = computed(() => {
  const map = new Map<string, ExtInfo[]>()
  for (const ext of enabledExtensions.value) {
    const cat = ext.categories[0] ?? 'autres'
    map.set(cat, [...(map.get(cat) ?? []), ext])
  }
  return [...map.entries()].sort((a, b) => category(a[0]).localeCompare(category(b[0])))
})

const isActive = (id: string) => store.active === `ext:${id}`
</script>

<template>
  <aside class="side">
    <template v-for="[cat, list] in groups" :key="cat">
      <h6>{{ category(cat) }}</h6>
      <div v-for="ext in list" :key="ext.id" class="item" :class="{ on: isActive(ext.id) }" @click="openTool(ext.id)">
        <ToolIcon :ext="ext" />
        <span class="name">{{ loc(ext.name) }}</span>
        <span v-if="ext.source === 'dev'" class="badge">{{ t('side.dev') }}</span>
        <span v-else-if="ext.source === 'local'" class="badge">{{ t('side.local') }}</span>
        <button
          class="star"
          :class="{ pinned: store.settings.favorites.includes(ext.id) }"
          :title="t('side.pin')"
          @click.stop="toggleFavorite(ext.id)"
        >
          <Icon name="star" :size="13" />
        </button>
      </div>
    </template>
    <p v-if="!groups.length" class="hint">{{ t('side.empty') }}</p>
  </aside>
</template>

<style scoped>
.side {
  width: 240px;
  background: var(--o-surface);
  border-right: 1px solid var(--o-border);
  overflow: auto;
  padding: 10px 0;
}
h6 {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--o-muted);
  padding: 12px 14px 6px;
  font-weight: 600;
}
.hint {
  margin: 0;
  padding: 2px 14px 6px;
  font-size: 12px;
  color: var(--o-muted);
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px 6px 14px;
  font-size: 13px;
  cursor: pointer;
  border-left: 2px solid transparent;
}
.item:hover {
  background: var(--o-surface-2);
}
.item.on {
  background: var(--o-surface-2);
  border-left-color: var(--o-accent);
}
.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge {
  font-size: 10px;
  color: var(--o-accent);
  font-family: var(--o-font-mono);
}
.star {
  border: 0;
  background: none;
  color: var(--o-muted);
  padding: 2px;
  cursor: pointer;
  opacity: 0;
  display: grid;
}
.item:hover .star,
.star.pinned {
  opacity: 1;
}
.star.pinned {
  color: var(--o-accent);
}
.star.pinned :deep(path) {
  fill: currentColor;
}
</style>
