<script setup lang="ts">
import { computed, ref } from 'vue'
import { loc } from '../lib/i18n'
import { store } from '../lib/store'
import type { ExtInfo } from '../lib/types'

const props = defineProps<{ ext: ExtInfo; size?: number }>()
const broken = ref(false)

const src = computed(() =>
  props.ext.icon && store.info ? `${store.info.extBaseUrl}${props.ext.id}/${props.ext.icon}` : null
)
const initials = computed(() => loc(props.ext.name).slice(0, 2).toUpperCase())
</script>

<template>
  <span class="tool-icon" :style="{ width: `${size ?? 22}px`, height: `${size ?? 22}px` }">
    <img v-if="src && !broken" :src="src" alt="" @error="broken = true" />
    <span v-else>{{ initials }}</span>
  </span>
</template>

<style scoped>
.tool-icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  border-radius: 6px;
  background: var(--o-surface-2);
  color: var(--o-accent);
  font-family: var(--o-font-mono);
  font-size: 10px;
  font-weight: 500;
  overflow: hidden;
}
.tool-icon img {
  width: 70%;
  height: 70%;
}
</style>
