<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../lib/api'
import { category, loc, locale, t } from '../lib/i18n'
import { packOf, PROFILES } from '../lib/profiles'
import { setExtensions, store, toast } from '../lib/store'
import type { BundledInfo } from '../lib/types'
import Logo from './Logo.vue'

const setLocale = (l: 'fr' | 'en') => (locale.value = l)
const step = ref<1 | 2>(1)
const picked = ref<string[]>([...store.settings.profiles])
const bundled = ref<BundledInfo[]>([])
const chosen = ref<string[]>([])
const busy = ref(false)

onMounted(async () => {
  try {
    bundled.value = await api.listBundled()
  } catch {
    bundled.value = []
  }
})

function toggle(id: string) {
  picked.value = picked.value.includes(id) ? picked.value.filter(p => p !== id) : [...picked.value, id]
}

const pack = computed(() => [...new Set(PROFILES.filter(p => picked.value.includes(p.id)).flatMap(packOf))])

/** Étape 2 : les outils du profil sont cochés, l'utilisateur garde la main. */
function next() {
  const installed = store.settings.onboarded ? store.extensions.map(e => e.id) : []
  chosen.value = bundled.value.map(b => b.id).filter(id => pack.value.includes(id) || installed.includes(id))
  step.value = 2
}

function toggleExt(id: string) {
  chosen.value = chosen.value.includes(id) ? chosen.value.filter(c => c !== id) : [...chosen.value, id]
}

async function finish() {
  busy.value = true
  try {
    if (bundled.value.length) setExtensions(await api.chooseExtensions(chosen.value))
  } catch (e) {
    toast(String(e), 'error')
  }
  busy.value = false
  const installed = new Set(store.extensions.map(e => e.id))
  const favorites = pack.value.filter(id => installed.has(id))
  store.settings.profiles = picked.value
  if (favorites.length) store.settings.favorites = favorites
  store.settings.onboarded = true
}
</script>

<template>
  <div class="overlay">
    <div class="card">
      <div class="lang">
        <button :class="{ on: locale === 'fr' }" @click="setLocale('fr')">FR</button>
        <button :class="{ on: locale === 'en' }" @click="setLocale('en')">EN</button>
      </div>
      <Logo :size="44" />

      <template v-if="step === 1">
        <h1>{{ t('onb.title') }}</h1>
        <p class="sub">{{ t('onb.sub') }}</p>
        <div class="profiles">
          <button
            v-for="p in PROFILES"
            :key="p.id"
            class="profile"
            :class="{ on: picked.includes(p.id) }"
            :aria-pressed="picked.includes(p.id)"
            @click="toggle(p.id)"
          >
            <span class="emoji">{{ p.emoji }}</span>
            <strong>{{ t(`prof.${p.id}`) }}</strong>
            <small>{{ t(`prof.${p.id}.d`) }}</small>
          </button>
        </div>
        <div class="actions">
          <button class="btn" @click="picked = []; next()">{{ t('onb.skip') }}</button>
          <button class="btn primary" :disabled="!picked.length" @click="next()">{{ t('onb.next') }}</button>
        </div>
      </template>

      <template v-else>
        <h1>{{ t('onb.pickTitle') }}</h1>
        <p class="sub">{{ t('onb.pickSub') }}</p>
        <div class="tools">
          <label v-for="b in bundled" :key="b.id" class="tool" :class="{ on: chosen.includes(b.id) }">
            <input type="checkbox" :checked="chosen.includes(b.id)" @change="toggleExt(b.id)" />
            <span class="name">{{ loc(b.name) }}</span>
            <small>{{ b.categories.map(category).join(' · ') }}</small>
          </label>
        </div>
        <div class="actions">
          <button class="btn" @click="step = 1">{{ t('onb.back') }}</button>
          <span class="spacer" />
          <button class="btn" @click="chosen = bundled.map(b => b.id)">{{ t('onb.all') }}</button>
          <button class="btn primary" :disabled="busy" @click="finish()">
            {{ t('onb.install', { n: chosen.length }) }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 36px 0 0;
  background: color-mix(in srgb, var(--o-bg) 80%, transparent);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 40;
  padding: 16px;
}
.card {
  position: relative;
  width: min(640px, 100%);
  background: var(--o-surface);
  border: 1px solid var(--o-border);
  border-radius: 14px;
  padding: 32px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
}
.lang {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 4px;
}
.lang button {
  border: 1px solid var(--o-border);
  background: none;
  color: var(--o-muted);
  font: inherit;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 5px;
  cursor: pointer;
}
.lang button.on {
  color: var(--o-accent);
  border-color: var(--o-accent);
}
h1 {
  font-size: 22px;
  margin: 16px 0 6px;
}
.sub {
  color: var(--o-muted);
  font-size: 14px;
  margin: 0 0 22px;
}
.profiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.profile {
  text-align: left;
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 12px;
  row-gap: 2px;
  align-items: center;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid var(--o-border);
  background: var(--o-bg);
  color: var(--o-text);
  font: inherit;
  cursor: pointer;
}
.profile .emoji {
  grid-row: span 2;
  font-size: 22px;
}
.profile small {
  color: var(--o-muted);
  font-size: 12px;
}
.profile.on {
  border-color: var(--o-accent);
  background: color-mix(in srgb, var(--o-accent) 10%, var(--o-bg));
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}
.spacer {
  flex: 1;
}
.tools {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  max-height: 46vh;
  overflow: auto;
}
.tool {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 10px;
  align-items: center;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid var(--o-border);
  background: var(--o-bg);
  cursor: pointer;
}
.tool small {
  grid-column: 2;
  color: var(--o-muted);
  font-size: 11.5px;
}
.tool.on {
  border-color: var(--o-accent);
}
</style>
