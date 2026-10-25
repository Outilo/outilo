<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import ActivityBar from './components/ActivityBar.vue'
import CommandPalette from './components/CommandPalette.vue'
import Explorer from './components/Explorer.vue'
import ExtFrame from './components/ExtFrame.vue'
import Onboarding from './components/Onboarding.vue'
import StatusBar from './components/StatusBar.vue'
import TabBar from './components/TabBar.vue'
import TitleBar from './components/TitleBar.vue'
import Toasts from './components/Toasts.vue'
import { handleShortcut, store } from './lib/store'
import type { ExtInfo, Tab } from './lib/types'
import ExtensionsView from './views/ExtensionsView.vue'
import HomeView from './views/HomeView.vue'
import SettingsView from './views/SettingsView.vue'
import ThemesView from './views/ThemesView.vue'

const pages = { home: HomeView, extensions: ExtensionsView, themes: ThemesView, settings: SettingsView }

const activeTab = computed(() => store.tabs.find(t => t.key === store.active))
const extTabs = computed(() =>
  store.tabs
    .filter((t): t is Extract<Tab, { kind: 'ext' }> => t.kind === 'ext')
    .map(tab => ({ tab, ext: store.extensions.find(e => e.id === tab.extId) }))
    .filter((x): x is { tab: Extract<Tab, { kind: 'ext' }>; ext: ExtInfo } => !!x.ext)
)

function onKey(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey)) return
  if (handleShortcut(e.key.toLowerCase(), e.shiftKey)) e.preventDefault()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="win">
    <TitleBar />
    <div class="main" :class="{ 'no-side': !store.sidebarOpen }">
      <ActivityBar />
      <Explorer v-if="store.sidebarOpen" />
      <section class="content">
        <TabBar />
        <div class="view">
          <component
            :is="pages[activeTab.page]"
            v-if="activeTab?.kind === 'page'"
            :key="activeTab.key"
          />
          <!-- Les outils ouverts restent montés pour conserver leur état -->
          <div v-for="{ tab, ext } in extTabs" v-show="store.active === tab.key" :key="tab.key" class="frame">
            <ExtFrame :ext="ext" :tab-key="tab.key" :reload="tab.reload" />
          </div>
        </div>
      </section>
    </div>
    <StatusBar />
    <Onboarding v-if="!store.settings.onboarded" />
    <CommandPalette />
    <Toasts />
  </div>
</template>

<style scoped>
.win {
  height: 100%;
  display: grid;
  grid-template-rows: 36px 1fr 26px;
  background: var(--o-bg);
}
.main {
  display: grid;
  grid-template-columns: 48px 240px 1fr;
  min-height: 0;
}
.main.no-side {
  grid-template-columns: 48px 1fr;
}
.content {
  display: grid;
  grid-template-rows: 36px 1fr;
  min-width: 0;
  min-height: 0;
}
.view {
  position: relative;
  min-height: 0;
}
.frame {
  position: absolute;
  inset: 0;
}
</style>
