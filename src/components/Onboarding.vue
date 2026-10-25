<script setup lang="ts">
import { ref } from 'vue'
import { locale, t } from '../lib/i18n'
import { packOf, PROFILES } from '../lib/profiles'
import { store } from '../lib/store'

const setLocale = (l: 'fr' | 'en') => (locale.value = l)
const picked = ref<string[]>([...store.settings.profiles])

function toggle(id: string) {
  picked.value = picked.value.includes(id) ? picked.value.filter(p => p !== id) : [...picked.value, id]
}

function finish(skip = false) {
  const profiles = skip ? [] : picked.value
  const installed = new Set(store.extensions.map(e => e.id))
  const pack = PROFILES.filter(p => profiles.includes(p.id)).flatMap(packOf)
  const favorites = [...new Set(pack)].filter(id => installed.has(id))
  store.settings.profiles = profiles
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
      <span class="mark">O</span>
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
        <button class="btn" @click="finish(true)">{{ t('onb.skip') }}</button>
        <button class="btn primary" :disabled="!picked.length" @click="finish()">{{ t('onb.start') }}</button>
      </div>
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
.mark {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--o-accent);
  color: var(--o-accent-ink);
  font-family: var(--o-font-mono);
  font-weight: 500;
  font-size: 18px;
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
</style>
