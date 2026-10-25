// Charge le script « navigateur » d'une extension dans un contexte isolé pour le tester sous Node.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

/** `vendor` : bibliothèques embarquées à charger avant logic.js (chemins relatifs à `ui/`). */
export function loadLogic(extension, vendor = []) {
  const context = {
    crypto: globalThis.crypto,
    TextEncoder,
    TextDecoder,
    atob,
    btoa,
    Date,
    Math,
    Intl,
    URL,
    URLSearchParams,
    encodeURIComponent,
    decodeURIComponent,
    escape,
    unescape,
    setTimeout,
    clearTimeout
  }
  context.globalThis = context
  context.self = context
  vm.createContext(context)
  for (const name of [...vendor, 'logic.js']) {
    const file = fileURLToPath(new URL(`../../extensions/${extension}/ui/${name}`, import.meta.url))
    vm.runInContext(readFileSync(file, 'utf8'), context, { filename: file })
  }
  return context
}
