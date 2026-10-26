// Squelette d'une nouvelle extension (utilisé par le serveur MCP et la doc développeur).
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const q = s => JSON.stringify(String(s ?? ''))

/** Fichiers du modèle, en mémoire : { chemin relatif: contenu }. */
export function templateFiles(o) {
  const perms = (o.permissions ?? ['clipboard']).map(p => (p.includes('.') ? `"${p}" = true` : `${p} = true`)).join('\n')
  const global = o.id.split('.').pop().replace(/(^|-)(\w)/g, (_, a, b) => b.toUpperCase()) + 'Logic'
  return {
    'outilo.toml': `[extension]
id = ${q(o.id)}
name = { fr = ${q(o.nameFr)}, en = ${q(o.nameEn || o.nameFr)} }
description = { fr = ${q(o.descriptionFr)}, en = ${q(o.descriptionEn || o.descriptionFr)} }
version = "0.1.0"
api = "1"
license = ${q(o.license || 'Apache-2.0')}
authors = [${q(o.author || 'Moi')}]
categories = [${(o.categories ?? ['autres']).map(q).join(', ')}]
icon = "icon.svg"

[ui]
entry = "ui/index.html"

[[commands]]
id = "hello"
title = { fr = "Dire bonjour", en = "Say hello" }

[permissions]
${perms}
`,
    'icon.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12h6M12 9v6"/></svg>
`,
    'ui/index.html': `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="/_sdk/outilo-ui.css">
</head>
<body>
  <div class="o-header">
    <h1 data-i18n="title">${o.nameFr}</h1>
    <p class="o-sub" data-i18n="subtitle">${o.descriptionFr}</p>
  </div>
  <div class="o-stack">
    <div class="o-panel o-row">
      <input class="o-input o-grow" id="input" data-i18n-placeholder="placeholder">
      <button class="o-btn o-btn--primary" id="go" data-i18n="go">Transformer</button>
    </div>
    <div class="o-out"><span id="out"></span><button class="o-btn o-btn--sm" id="copy" data-i18n="copy">Copier</button></div>
  </div>
  <script src="/_sdk/outilo-sdk.js"></script>
  <script src="logic.js"></script>
  <script src="main.js"></script>
</body>
</html>
`,
    'ui/logic.js': `// Logique pure, sans DOM : testée par tests/logic.test.mjs.
;(function (root) {
  'use strict'

  function transform(text) {
    return String(text).trim().toUpperCase()
  }

  root.${global} = { transform: transform }
})(typeof window !== 'undefined' ? window : globalThis)
`,
    'ui/main.js': `/* global outilo, ${global} */
'use strict'

outilo.messages = {
  fr: { title: ${q(o.nameFr)}, subtitle: ${q(o.descriptionFr)}, placeholder: 'Votre texte…', go: 'Transformer', copy: 'Copier', copied: 'Copié', hello: 'Bonjour !' },
  en: { title: ${q(o.nameEn || o.nameFr)}, subtitle: ${q(o.descriptionEn || o.descriptionFr)}, placeholder: 'Your text…', go: 'Transform', copy: 'Copy', copied: 'Copied', hello: 'Hello!' }
}

var $ = function (s) { return document.querySelector(s) }

function run() { $('#out').textContent = ${global}.transform($('#input').value) }

$('#go').addEventListener('click', run)
$('#input').addEventListener('input', run)
$('#copy').addEventListener('click', async function () {
  await outilo.clipboard.write($('#out').textContent)
  outilo.toast(outilo.t('copied'), 'success')
})

// Commandes déclarées dans [[commands]] : lancées depuis la palette Ctrl+K
outilo.onCommand(function (cmd) { if (cmd === 'hello') outilo.toast(outilo.t('hello'), 'info') })
outilo.ready.then(function () { $('#input').focus() })
`,
    'tests/logic.test.mjs': `// Lancer : node --test tests/   (ou l'outil MCP outilo_test_extension)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const context = { globalThis: {} }
context.globalThis = context
vm.createContext(context)
vm.runInContext(readFileSync(new URL('../ui/logic.js', import.meta.url), 'utf8'), context)
const L = context.${global}

test('transform', () => {
  assert.equal(L.transform('  outilo '), 'OUTILO')
})
`,
    'README.md': `# ${o.nameFr}

${o.descriptionFr}

Extension pour [Outilo](https://github.com/Outilo/outilo). Format et API : \`extensions/README.md\` du dépôt Outilo.

- Tester dans Outilo : Paramètres → Mode développeur, puis Extensions → Charger un dossier… (ou \`outilo_link_extension\`).
- Tests : \`node --test tests/\`
`,
    'CLAUDE.md': `# CLAUDE.md — extension Outilo « ${o.nameFr} »

- Une extension Outilo est une page HTML isolée (iframe sans réseau, sans accès à Tauri). Tout passe par \`window.outilo\`
  (SDK chargé par \`/_sdk/outilo-sdk.js\`) et chaque appel est vérifié contre \`[permissions]\` de \`outilo.toml\`.
- Pas de ressource externe (CDN, polices en ligne) : embarquer les bibliothèques dans \`ui/vendor/\` avec leur licence.
- Logique pure dans \`ui/logic.js\` (testée sous Node), interface dans \`ui/main.js\`.
- Textes en FR et EN via \`outilo.messages\` et \`data-i18n\`. Couleurs : uniquement les variables \`--o-*\` et les classes \`o-*\`.
- Avant de proposer l'extension : \`outilo_validate_extension\` puis \`outilo_test_extension\`. Toute nouvelle version : monter \`version\`.
`
  }
}

/** Écrit le squelette dans `dir` (qui doit être absent ou vide). */
export function scaffold(dir, options) {
  if (existsSync(dir) && readdirSync(dir).length) throw new Error(`${dir} n'est pas vide`)
  const files = templateFiles(options)
  for (const [rel, content] of Object.entries(files)) {
    const path = join(dir, rel)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  return Object.keys(files)
}
