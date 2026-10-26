<script setup lang="ts">
// Logo d'Outilo (même dessin que src-tauri/icons/icon.svg) ; le fond suit la couleur d'accent du thème.
defineProps<{ size?: number }>()
</script>

<template>
  <svg class="logo" :width="size ?? 18" :height="size ?? 18" viewBox="0 0 1024 1024" aria-hidden="true">
    <rect width="1024" height="1024" rx="232" />
    <g transform="rotate(-45 512 512)">
      <rect x="452" y="440" width="120" height="300" rx="20" />
      <path
        fill-rule="evenodd"
        d="M512 90a190 190 0 1 1 0 380a190 190 0 1 1 0-380z M512 196l92 53v106l-92 53l-92-53v-106z"
      />
      <path
        d="M512 640c88 0 150 64 150 146c0 46-20 86-52 114l-38-92h-120l-38 92c-32-28-52-68-52-114c0-82 62-146 150-146z"
      />
    </g>
  </svg>
</template>

<style scoped>
.logo {
  flex: none;
  display: block;
}
.logo > rect {
  fill: var(--o-accent);
}
.logo g {
  fill: var(--o-accent-ink);
}
</style>
