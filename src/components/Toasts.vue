<script setup lang="ts">
import { store } from '../lib/store'
</script>

<template>
  <div class="toasts" aria-live="polite">
    <div v-for="toast in store.toasts" :key="toast.id" class="toast" :class="toast.type">{{ toast.message }}</div>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 60;
  pointer-events: none;
}
.toast {
  background: var(--o-text);
  color: var(--o-bg);
  font-size: 12.5px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  animation: in 0.18s ease-out;
  max-width: 520px;
}
.toast.success {
  border-left: 3px solid var(--o-success);
}
.toast.error {
  background: var(--o-danger);
  color: #fff;
}
@keyframes in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
</style>
