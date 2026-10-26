<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../lib/i18n'
import { dismissAppUpdate, installAppUpdate, store } from '../lib/store'
import Icon from './Icon.vue'

const update = computed(() =>
  store.appUpdate && store.settings.appUpdateDismissed !== store.appUpdate.latest ? store.appUpdate : null
)
</script>

<!-- Racine toujours présente : elle occupe la ligne « auto » de la grille, vide sans mise à jour -->
<template>
  <div>
    <div v-if="update" class="banner" role="status">
      <Icon name="download" :size="14" />
      <span class="text">{{ t('app.updateAvailable', { v: update.latest, current: update.current }) }}</span>
      <span v-if="store.appUpdating" class="muted">{{ t('app.updating') }}</span>
      <template v-else>
        <button class="btn sm primary" @click="installAppUpdate()">{{ t('app.updateNow') }}</button>
        <button class="btn sm" @click="dismissAppUpdate()">{{ t('app.later') }}</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  font-size: 12.5px;
  background: color-mix(in srgb, var(--o-accent) 14%, var(--o-surface));
  border-bottom: 1px solid var(--o-border);
  color: var(--o-text);
}
.banner :deep(svg) {
  color: var(--o-accent);
}
.text {
  flex: 1;
}
.muted {
  color: var(--o-muted);
}
</style>
