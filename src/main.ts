import { createApp } from 'vue'
import App from './App.vue'
import { init } from './lib/store'
import './styles/app.css'

// Menu contextuel du navigateur inutile dans une application de bureau (sauf champs de saisie)
document.addEventListener('contextmenu', e => {
  const el = e.target as HTMLElement
  if (!el.closest('input, textarea, [contenteditable]')) e.preventDefault()
})

init()
  .catch(err => console.error('Initialisation impossible', err))
  .finally(() => createApp(App).mount('#app'))
