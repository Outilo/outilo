<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import ToolIcon from '../components/ToolIcon.vue'
import { api, inTauri } from '../lib/api'
import { locale, loc, t } from '../lib/i18n'
import {
  checkUpdates,
  installFromRegistry,
  openTool,
  rollbackExtension,
  setExtensions,
  store,
  toast,
  updates
} from '../lib/store'
import type { Available, ExtList } from '../lib/types'

const confirming = ref<string | null>(null)
const busy = ref(false)

const reg = store.registry
const devDocs = computed(() => store.extensions.find(e => e.id === 'outilo.devdocs' && e.enabled))
/** Catalogue : registre en ligne, complété par le pack embarqué (disponible hors ligne). */
const catalog = computed<Available[]>(() => {
  const installed = new Set(store.extensions.map(e => e.id))
  const online = reg.items.filter(i => !installed.has(i.id))
  const offline = store.bundled
    .filter(b => !installed.has(b.id) && !online.some(i => i.id === b.id))
    .map(b => ({ ...b, installed: null, update: false, newPermissions: [], skipped: false, size: 0, bundled: true }))
  return [...online, ...offline].sort((a, b) => loc(a.name).localeCompare(loc(b.name)))
})
const lastCheck = computed(() =>
  reg.checkedAt ? t('upd.lastCheck', { time: new Date(reg.checkedAt).toLocaleString(locale.value) }) : t('upd.never')
)

async function run(action: () => Promise<ExtList | null>, success?: string) {
  busy.value = true
  try {
    const list = await action()
    if (list) {
      setExtensions(list)
      if (success) toast(success, 'success')
    }
  } catch (e) {
    toast(String(e), 'error')
  } finally {
    busy.value = false
  }
}

/** Extension privée (dossier ou .outilo) : confirmation native puis installation sur ce PC uniquement. */
function installLocal(fromFile: boolean) {
  run(() => api.installLocal(fromFile), t('ext.localInstalled'))
}

function toggle(id: string, enabled: boolean) {
  run(() => api.setExtensionEnabled(id, enabled))
}

/** Double clic de confirmation (désinstallation, nouvelles permissions). */
function confirmed(key: string): boolean {
  if (confirming.value === key) {
    confirming.value = null
    return true
  }
  confirming.value = key
  window.setTimeout(() => confirming.value === key && (confirming.value = null), 4000)
  return false
}

function uninstall(id: string) {
  if (confirmed(`rm:${id}`)) run(() => api.uninstallExtension(id), t('ext.removed'))
}

function update(item: Available) {
  if (item.newPermissions.length && !confirmed(`up:${item.id}`)) return
  installFromRegistry(item.id)
}

async function updateAll() {
  for (const item of updates.value.filter(u => !u.newPermissions.length)) await installFromRegistry(item.id)
}

function install(item: Available & { bundled?: boolean }) {
  if (!confirmed(`in:${item.id}`)) return
  if (item.bundled) run(() => api.installBundled(item.id), t('upd.installed', { name: loc(item.name), v: item.version }))
  else installFromRegistry(item.id)
}

const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.ceil(n / 1024)} Ko`)
</script>

<template>
  <div class="page">
    <div class="head">
      <div>
        <h1>{{ t('ext.title') }}</h1>
        <p class="sub">{{ t('ext.sub') }}</p>
      </div>
      <div class="row">
        <button v-if="inTauri" class="btn primary" :disabled="reg.checking" @click="checkUpdates(true)">
          <Icon name="download" :size="14" /> {{ t('upd.check') }}
        </button>
        <button class="btn" :disabled="busy" @click="run(api.reloadExtensions, t('ext.reloaded'))">
          <Icon name="reload" :size="14" /> {{ t('ext.reload') }}
        </button>
        <button v-if="inTauri" class="btn" :disabled="busy" :title="t('ext.localHint')" @click="installLocal(true)">
          <Icon name="upload" :size="14" /> {{ t('ext.installFile') }}
        </button>
        <button v-if="inTauri" class="btn" :disabled="busy" :title="t('ext.localHint')" @click="installLocal(false)">
          <Icon name="folder" :size="14" /> {{ t('ext.installFolder') }}
        </button>
        <button
          v-if="store.settings.devMode && inTauri"
          class="btn"
          :disabled="busy"
          @click="run(api.addDevExtension, t('ext.added'))"
        >
          <Icon name="folder" :size="14" /> {{ t('ext.addDev') }}
        </button>
      </div>
    </div>

    <p class="note"><Icon name="download" :size="13" /> {{ t('ext.registry') }}</p>
    <template v-if="inTauri">
      <p class="note">{{ lastCheck }}</p>
      <p v-if="reg.offline" class="note warn"><Icon name="warning" :size="13" /> {{ t('upd.offline') }} — {{ reg.offline }}</p>
      <p v-if="reg.error" class="note warn"><Icon name="warning" :size="13" /> {{ t('upd.error') }} — {{ reg.error }}</p>
      <p v-if="store.info && !store.info.signedUpdates" class="note warn">
        <Icon name="shield" :size="13" /> {{ t('upd.unsigned') }}
      </p>
    </template>
    <p v-else class="note">{{ t('upd.preview') }}</p>
    <p v-if="!store.settings.devMode" class="note">{{ t('ext.devHint') }}</p>

    <!-- Bac à sable -->
    <section v-if="store.settings.devMode && inTauri" class="section panel sandbox">
      <div class="section-head">
        <h2>{{ t('dev.title') }}</h2>
        <button v-if="devDocs" class="btn sm" @click="openTool(devDocs.id)">{{ t('dev.docs') }}</button>
      </div>
      <p class="desc">{{ t('dev.sub') }}</p>
      <label class="switch"><input v-model="store.settings.devSimulate" type="checkbox" /> {{ t('dev.simulate') }}</label>
      <div class="section-head" style="margin-top: 12px">
        <span class="muted">{{ t('dev.log') }}</span>
        <button class="btn sm" :disabled="!store.devLog.length" @click="store.devLog.splice(0)">{{ t('dev.clear') }}</button>
      </div>
      <div class="log">
        <p v-if="!store.devLog.length" class="muted">{{ t('dev.empty') }}</p>
        <div v-for="(c, i) in store.devLog.slice(0, 60)" :key="i" class="call" :class="{ err: c.error }">
          <span class="mono">{{ new Date(c.time).toLocaleTimeString(locale) }}</span>
          <span class="mono">{{ c.extId }}</span>
          <strong class="mono">{{ c.method }}</strong>
          <span class="mono">{{ c.ms }} ms</span>
          <span v-if="c.simulated" class="chip acc">{{ t('dev.sim') }}</span>
          <span v-if="c.error" class="mono">{{ c.error }}</span>
        </div>
      </div>
    </section>

    <!-- Mises à jour -->
    <section v-if="updates.length" class="section">
      <div class="section-head">
        <h2>{{ t('upd.available') }} <span class="count">{{ updates.length }}</span></h2>
        <button class="btn sm" :disabled="!!reg.installing.length" @click="updateAll">{{ t('upd.updateAll') }}</button>
      </div>
      <div v-for="item in updates" :key="item.id" class="panel upd">
        <div class="info">
          <div class="title">
            <strong>{{ loc(item.name) }}</strong>
            <span class="mono">{{ item.installed }} → {{ item.version }}</span>
            <span v-if="item.size" class="mono">{{ size(item.size) }}</span>
          </div>
          <div v-if="item.newPermissions.length" class="perms">
            <Icon name="warning" :size="13" />
            <span class="muted">{{ t('upd.newPerms') }} :</span>
            <span v-for="p in item.newPermissions" :key="p" class="chip warn">{{ t(`perm.${p}`) }}</span>
          </div>
        </div>
        <button class="btn sm primary" :disabled="reg.installing.includes(item.id)" @click="update(item)">
          {{ item.newPermissions.length ? (confirming === `up:${item.id}` ? t('ext.confirm') : t('upd.accept')) : t('upd.update') }}
        </button>
      </div>
    </section>

    <!-- Installées -->
    <section class="section">
      <h2>{{ t('upd.installedList') }} <span class="count">{{ store.extensions.length }}</span></h2>
      <div class="list">
        <div v-for="ext in store.extensions" :key="ext.id" class="panel ext" :class="{ off: !ext.enabled }">
          <ToolIcon :ext="ext" :size="44" />
          <div class="info">
            <div class="title">
              <strong>{{ loc(ext.name) }}</strong>
              <span class="mono">{{ ext.version }}</span>
              <span class="chip" :class="ext.source !== 'official' ? 'acc' : ''">
                {{ ext.source === 'dev' ? t('ext.devBadge') : ext.source === 'local' ? t('ext.localBadge') : t('ext.official') }}
              </span>
            </div>
            <p class="desc">{{ loc(ext.description) }}</p>
            <div class="perms">
              <Icon name="shield" :size="13" />
              <span class="muted">{{ t('ext.permissions') }} :</span>
              <span v-if="!ext.permissions.length" class="muted">{{ t('ext.noPermission') }}</span>
              <span
                v-for="p in ext.permissions"
                :key="p"
                class="chip"
                :class="{ warn: ext.sensitive.includes(p) }"
                :title="ext.sensitive.includes(p) ? t('ext.sensitive') : p"
              >
                {{ t(`perm.${p}`) }}
              </span>
            </div>
            <p v-if="ext.hosts.length" class="mono path">{{ t('ext.hosts') }} : {{ ext.hosts.join(', ') }}</p>
            <p class="mono path" :title="ext.path">{{ ext.id }}</p>
          </div>
          <div class="actions">
            <label class="switch">
              <input
                type="checkbox"
                :checked="ext.enabled"
                :disabled="busy"
                @change="toggle(ext.id, !ext.enabled)"
              />
              {{ t('ext.enabled') }}
            </label>
            <button class="btn sm" :disabled="!ext.enabled" @click="openTool(ext.id)">
              <Icon name="play" :size="12" /> {{ t('ext.open') }}
            </button>
            <button v-if="inTauri && ext.previous" class="btn sm" :disabled="busy" @click="rollbackExtension(ext.id)">
              <Icon name="reload" :size="12" /> {{ t('upd.rollback', { v: ext.previous }) }}
            </button>
            <button v-if="inTauri" class="btn sm danger" :disabled="busy" @click="uninstall(ext.id)">
              <Icon name="trash" :size="12" /> {{ confirming === `rm:${ext.id}` ? t('ext.confirm') : t('ext.uninstall') }}
            </button>
          </div>
        </div>
        <p v-if="!store.extensions.length" class="muted">{{ t('ext.none') }}</p>
      </div>
    </section>

    <!-- Catalogue -->
    <section v-if="catalog.length" class="section">
      <h2>{{ t('upd.catalog') }} <span class="count">{{ catalog.length }}</span></h2>
      <div v-for="item in catalog" :key="item.id" class="panel upd">
        <div class="info">
          <div class="title">
            <strong>{{ loc(item.name) }}</strong>
            <span class="mono">{{ item.version }}</span>
            <span class="chip" :class="{ acc: item.verified === false }">
              {{ item.verified === false ? t('ext.community') : t('ext.official') }}
            </span>
            <span v-if="item.verified === false && item.authors?.length" class="mono">{{ item.authors.join(', ') }}</span>
          </div>
          <p class="desc">{{ loc(item.description) }}</p>
          <div class="perms">
            <Icon name="shield" :size="13" />
            <span v-if="!item.permissions.length" class="muted">{{ t('ext.noPermission') }}</span>
            <span v-for="p in item.permissions" :key="p" class="chip">{{ t(`perm.${p}`) }}</span>
          </div>
        </div>
        <button class="btn sm primary" :disabled="reg.installing.includes(item.id)" @click="install(item)">
          {{ confirming === `in:${item.id}` ? t('ext.confirm') : t('upd.install') }}
        </button>
      </div>
    </section>

    <button v-if="inTauri" class="btn restore" :disabled="busy" @click="run(api.restoreOfficialExtensions, t('ext.restored'))">
      {{ t('ext.restore') }}
    </button>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}
.note {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--o-muted);
  font-size: 12.5px;
  margin-top: 10px;
}
.note.warn {
  color: var(--o-danger);
}
.section {
  margin-top: 26px;
}
.section h2 {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--o-muted);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.count {
  font-family: var(--o-font-mono);
  font-size: 11px;
  background: var(--o-surface-2);
  border-radius: 10px;
  padding: 1px 7px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.upd {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}
.ext {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.ext.off {
  opacity: 0.6;
}
.ext :deep(.tool-icon) {
  border-radius: 10px;
  font-size: 14px;
}
.info {
  flex: 1;
  min-width: 0;
}
.title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.desc {
  color: var(--o-muted);
  font-size: 13px;
  margin: 4px 0 10px;
}
.perms {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  color: var(--o-muted);
  font-size: 12px;
  margin-top: 6px;
}
.mono {
  font-family: var(--o-font-mono);
  font-size: 11.5px;
  color: var(--o-muted);
}
.path {
  margin-top: 8px;
}
.muted {
  color: var(--o-muted);
}
.actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.sandbox .desc {
  margin-bottom: 10px;
}
.log {
  max-height: 220px;
  overflow: auto;
  margin-top: 6px;
  font-size: 12px;
}
.call {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 3px 0;
  border-bottom: 1px solid var(--o-border);
}
.call.err strong,
.call.err span:last-child {
  color: var(--o-danger);
}
.restore {
  margin-top: 24px;
}
</style>
