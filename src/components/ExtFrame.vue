<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { registerFrame, unregisterFrame } from '../lib/extHost'
import { store } from '../lib/store'
import type { ExtInfo } from '../lib/types'

const props = defineProps<{ ext: ExtInfo; tabKey: string; reload: number }>()
const frame = ref<HTMLIFrameElement | null>(null)
let registered: Window | null = null

// Le paramètre `r` force le rechargement (mode développeur)
const src = computed(() => `${store.info?.extBaseUrl ?? ''}${props.ext.id}/${props.ext.entry}?r=${props.reload}`)

watch(frame, el => {
  if (registered) unregisterFrame(registered)
  registered = el?.contentWindow ?? null
  if (registered) registerFrame(registered, props.ext.id, props.tabKey)
})

onBeforeUnmount(() => {
  if (registered) unregisterFrame(registered)
})
</script>

<template>
  <!-- Pas de allow-same-origin : l'extension n'a ni cookies, ni stockage, ni accès au shell -->
  <iframe ref="frame" :key="reload" class="ext-frame" :src="src" sandbox="allow-scripts" :aria-label="ext.id" />
</template>

<style scoped>
.ext-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  background: var(--o-bg);
}
</style>
