/* global outilo, DevLogic */
'use strict'

// Les pages sont écrites ici en HTML statique (aucune donnée extérieure n'y est insérée sans échappement).
var PAGES = {
  fr: {
    start: ['Démarrer', [
      '<h2>Créer une extension Outilo</h2>',
      '<p>Une extension est une petite page web (HTML, CSS, JavaScript) qu’Outilo affiche dans un cadre isolé : pas de réseau, pas d’accès direct au système. Tout passe par le kit <code>window.outilo</code>, et chaque appel est vérifié contre les permissions déclarées dans <code>outilo.toml</code>.</p>',
      '<h3>Trois façons de commencer</h3>',
      '<ol><li><strong>Avec votre IA</strong> : ajoutez le serveur MCP (page « Assistant IA ») puis demandez « crée une extension Outilo qui… ».</li>',
      '<li><strong>À la main</strong> : copiez le squelette (page « Manifeste ») dans un dossier, puis Extensions → Charger un dossier…</li>',
      '<li><strong>Depuis une extension existante</strong> : le dépôt <code>Outilo/outilo</code> en contient 27 dans <code>extensions/</code>.</li></ol>',
      '<h3>Structure</h3>',
      '<pre class="o-pre">mon-outil/\n├─ outilo.toml       manifeste\n├─ icon.svg\n├─ ui/\n│  ├─ index.html     charge /_sdk/outilo-ui.css et /_sdk/outilo-sdk.js\n│  ├─ logic.js       logique pure, testable sous Node\n│  ├─ main.js        interface\n│  └─ vendor/        bibliothèques tierces + licences\n└─ tests/            node --test tests/</pre>'
    ]],
    manifest: ['Manifeste', [
      '<h2>outilo.toml</h2>',
      '<pre class="o-pre">[extension]\nid = "marie.slugify"                 # auteur.nom, minuscules (outilo.* réservé)\nname = { fr = "Slugify", en = "Slugify" }\ndescription = { fr = "…", en = "…" }\nversion = "0.1.0"                    # semver : à monter à chaque publication\napi = "1"\nlicense = "MIT"\ncategories = ["texte"]\nicon = "icon.svg"\n\n[ui]\nentry = "ui/index.html"\n\n[[commands]]                         # apparaît dans la palette Ctrl+K\nid = "copy"\ntitle = { fr = "Copier un slug", en = "Copy a slug" }\n\n[permissions]\nclipboard = true\nnetwork = ["api.exemple.com"]       # liste des domaines\n"storage.sql" = true                 # entre guillemets si « storage » est aussi déclaré</pre>',
      '<p>Catégories : securite, generateur, donnees, code, texte, reseau, systeme, design, autres.</p>'
    ]],
    permissions: ['Permissions', [
      '<h2>Permissions</h2>',
      '<table class="o-table"><thead><tr><th>Permission</th><th>Accès</th><th>Store</th></tr></thead><tbody>',
      '<tr><td>clipboard</td><td>Écrire dans le presse-papiers</td><td>✓</td></tr>',
      '<tr><td>storage</td><td>Clé / valeur JSON privé (5 Mo)</td><td>✓</td></tr>',
      '<tr><td>storage.sql</td><td>Base SQLite privée (50 Mo)</td><td>✓</td></tr>',
      '<tr><td>files.save</td><td>Boîte « Enregistrer sous »</td><td>✓</td></tr>',
      '<tr><td>system.info</td><td>OS, processeur, mémoire, disques</td><td>✓</td></tr>',
      '<tr><td>network = ["domaine"]</td><td>HTTP vers les domaines listés</td><td>✓ (pas « * »)</td></tr>',
      '<tr><td>process</td><td>Lister / arrêter des processus</td><td>officielles</td></tr>',
      '<tr><td>files.scoped</td><td>Caches du profil (nettoyeur)</td><td>officielles</td></tr>',
      '<tr><td>shell.safe</td><td>Commandes système prédéfinies</td><td>officielles</td></tr>',
      '</tbody></table>',
      '<p>Une permission non déclarée est refusée par Outilo, même si le code l’appelle.</p>'
    ]],
    sdk: ['API du SDK', ['<h2>window.outilo</h2>', '__SDK__',
      '<h3>Exemple</h3><pre class="o-pre">outilo.messages = { fr: { copied: \'Copié\' }, en: { copied: \'Copied\' } }\n\noutilo.ready.then(async () => {\n  await outilo.clipboard.write(\'Bonjour\')\n  outilo.toast(outilo.t(\'copied\'), \'success\')\n})\n\noutilo.onCommand(cmd => { if (cmd === \'copy\') … })</pre>']],
    ui: ['Composants', ['<h2>Composants CSS (outilo-ui.css)</h2>',
      '<p>Toujours via les variables du thème (<code>--o-bg</code>, <code>--o-surface</code>, <code>--o-accent</code>…) : l’extension suit automatiquement les thèmes clair, sombre et personnalisés.</p>',
      '<div class="o-panel o-stack"><div class="demo"><button class="o-btn o-btn--primary">o-btn--primary</button><button class="o-btn">o-btn</button><button class="o-btn o-btn--sm">o-btn--sm</button><button class="o-chip on">o-chip.on</button><button class="o-chip">o-chip</button><span class="o-badge">o-badge</span></div>',
      '<div class="demo"><input class="o-input" style="width:200px" placeholder="o-input"><select class="o-select"><option>o-select</option></select><label class="o-check"><input type="checkbox" checked> o-check</label></div>',
      '<div class="o-out"><span>o-out</span><button class="o-btn o-btn--sm">Copier</button></div><div class="o-meter"><i style="width:60%"></i></div><p class="o-sub">o-sub · <span class="o-ok">o-ok</span> · <span class="o-err">o-err</span></p></div>',
      '<p>Mise en page : <code>o-header</code>, <code>o-stack</code>, <code>o-row</code>, <code>o-grow</code>, <code>o-spacer</code>, <code>o-grid</code>, <code>o-panel</code>, <code>o-table</code>, <code>o-pre</code>, <code>o-textarea</code>, <code>o-label</code>.</p>']],
    sandbox: ['Bac à sable', ['<h2>Tester dans Outilo</h2>',
      '<ol><li>Paramètres → <strong>Mode développeur</strong>.</li><li>Extensions → <strong>Charger un dossier…</strong> (ou l’outil MCP <code>outilo_link_extension</code>).</li>',
      '<li>Modifiez vos fichiers : l’extension se recharge toute seule.</li><li>Extensions → <strong>Bac à sable</strong> : journal des appels d’API, erreurs de permission, et simulation des actions système.</li></ol>',
      '<p>Tests de la logique : <code>node --test tests/</code>. La logique de <code>ui/logic.js</code> se charge dans un contexte <code>vm</code> de Node (voir le squelette).</p>']],
    ai: ['Assistant IA', ['<h2>Serveur MCP outilo-mcp</h2>',
      '<p>Votre assistant (Claude, Cursor, VS Code…) peut créer, valider, tester, relier et proposer votre extension. Node 22+ requis.</p>', '__MCP__',
      '<h3>Outils</h3><ul><li><code>outilo_guide</code> — toute la documentation</li><li><code>outilo_create_extension</code> — squelette (+ CLAUDE.md)</li><li><code>outilo_validate_extension</code>, <code>outilo_test_extension</code></li><li><code>outilo_link_extension</code> — bac à sable</li><li><code>outilo_package_extension</code> — paquet .outilo</li><li><code>outilo_submit_extension</code> — proposition au store (Pull Request, avec votre accord)</li></ul>',
      '<h3>Exemple de demande</h3><pre class="o-pre">Crée une extension Outilo « Convertisseur d’unités » (longueurs, poids, températures),\nen français et en anglais, avec des tests. Valide-la, relie-la à Outilo,\npuis propose-la au store après m’avoir montré le résultat.</pre>']],
    publish: ['Publier', ['<h2>Proposer au store</h2>',
      '<ol><li>Validez : outil MCP <code>outilo_validate_extension</code> ou ci-dessous « Vérifier un manifeste ».</li><li>Proposez : <code>outilo_submit_extension</code>, ou une Pull Request sur <code>Outilo/outilo</code> ajoutant <code>extensions/&lt;id&gt;/</code>.</li>',
      '<li>La CI vérifie le manifeste, les règles et vos tests ; l’équipe Outilo relit le code.</li><li>Après fusion, le paquet est signé et publié : il apparaît dans le catalogue avec le badge « Communauté ».</li></ol>',
      '<h3>Règles</h3><ul><li>Aucune ressource externe (CDN, polices en ligne).</li><li>Permissions au plus juste ; domaines réseau listés.</li><li>FR + EN, licence libre, 30 Mo maximum.</li><li>Nouvelle version = <code>version</code> montée ; une version publiée ne change plus.</li></ul>']],
    check: ['Vérifier un manifeste', ['<h2>Vérifier un manifeste</h2><p>Collez votre <code>outilo.toml</code> : mêmes règles que la CI du store.</p>', '__CHECK__']]
  }
}

// Version anglaise : mêmes pages, textes traduits pour la navigation et les explications principales
PAGES.en = JSON.parse(JSON.stringify(PAGES.fr))
;(function () {
  var t = {
    start: 'Getting started', manifest: 'Manifest', permissions: 'Permissions', sdk: 'SDK API', ui: 'Components',
    sandbox: 'Sandbox', ai: 'AI assistant', publish: 'Publish', check: 'Check a manifest'
  }
  Object.keys(t).forEach(function (k) { PAGES.en[k][0] = t[k] })
  PAGES.en.start[1][0] = '<h2>Create an Outilo extension</h2>'
  PAGES.en.start[1][1] = '<p>An extension is a small web page (HTML, CSS, JavaScript) that Outilo shows in an isolated frame: no network, no direct system access. Everything goes through the <code>window.outilo</code> kit, and every call is checked against the permissions declared in <code>outilo.toml</code>.</p>'
  PAGES.en.start[1][2] = '<h3>Three ways to start</h3>'
  PAGES.en.start[1][3] = '<ol><li><strong>With your AI</strong>: add the MCP server (“AI assistant” page) then ask “create an Outilo extension that…”.</li>'
  PAGES.en.start[1][4] = '<li><strong>By hand</strong>: copy the skeleton (“Manifest” page) into a folder, then Extensions → Load a folder…</li>'
  PAGES.en.start[1][5] = '<li><strong>From an existing extension</strong>: the <code>Outilo/outilo</code> repository has 27 in <code>extensions/</code>.</li></ol>'
  PAGES.en.ai[1][1] = '<p>Your assistant (Claude, Cursor, VS Code…) can create, validate, test, link and submit your extension. Requires Node 22+.</p>'
  PAGES.en.check[1][0] = '<h2>Check a manifest</h2><p>Paste your <code>outilo.toml</code>: same rules as the store CI.</p>'
})()

var SDK_DESC = {
  fr: { ready: 'Promesse : thème et langue appliqués', i18n: 'Traductions ; data-i18n="clé" sur les éléments', locale: 'fr / en, dark / light',
    clipboard: 'Écrit dans le presse-papiers', storage: 'Clé / valeur JSON privé', sql: 'Base SQLite privée ; { columns, rows, changes }',
    save: 'Boîte « Enregistrer sous » ; binaire en base64', system: 'Infos matériel / OS', fetch: 'HTTP(S) vers un domaine déclaré',
    netdiag: 'DNS, port TCP, ping ICMP, interfaces', process: 'Processus ; kill avec confirmation Windows', clean: 'Caches connus du profil ; confirmation',
    dns: 'Vider le cache DNS', toast: 'Notification du shell', events: 'Commandes de palette, langue, thème' },
  en: { ready: 'Promise: theme and language applied', i18n: 'Translations; data-i18n="key" on elements', locale: 'fr / en, dark / light',
    clipboard: 'Writes to the clipboard', storage: 'Private JSON key / value', sql: 'Private SQLite database; { columns, rows, changes }',
    save: '“Save as” dialog; binary as base64', system: 'Hardware / OS info', fetch: 'HTTP(S) to a declared domain',
    netdiag: 'DNS, TCP port, ICMP ping, interfaces', process: 'Processes; kill with a Windows confirmation', clean: 'Known profile caches; confirmation',
    dns: 'Flush the DNS cache', toast: 'Shell notification', events: 'Palette commands, language, theme' }
}

var ERRORS = {
  fr: { id: 'identifiant invalide (auteur.nom, minuscules)', reserved: 'le préfixe « outilo. » est réservé', name: 'nom manquant',
    version: 'version invalide (semver, ex. 1.0.0)', api: 'api doit valoir "1"', ui: 'section [ui] manquante', entry: '[ui].entry doit être un chemin relatif',
    unknown: 'permission inconnue', sensitive: 'permission réservée aux extensions officielles', network: 'network attend une liste de domaines',
    networkAll: 'network = ["*"] est réservé aux extensions officielles', description: 'description manquante', license: 'licence non précisée',
    nameLocalized: 'nom non traduit : name = { fr = "…", en = "…" }', valid: '✓ Manifeste valide', invalid: '✗ Manifeste invalide',
    community: 'Règles du store (extension tierce)', copy: 'Copier', copied: 'Copié', title: 'Doc développeur' },
  en: { id: 'invalid id (author.name, lowercase)', reserved: 'the “outilo.” prefix is reserved', name: 'missing name',
    version: 'invalid version (semver, e.g. 1.0.0)', api: 'api must be "1"', ui: 'missing [ui] section', entry: '[ui].entry must be a relative path',
    unknown: 'unknown permission', sensitive: 'permission reserved for official extensions', network: 'network expects a list of domains',
    networkAll: 'network = ["*"] is reserved for official extensions', description: 'missing description', license: 'no license',
    nameLocalized: 'untranslated name: name = { fr = "…", en = "…" }', valid: '✓ Valid manifest', invalid: '✗ Invalid manifest',
    community: 'Store rules (third-party extension)', copy: 'Copy', copied: 'Copied', title: 'Developer docs' }
}
outilo.messages = ERRORS

var $ = function (s) { return document.querySelector(s) }
var page = 'start'
var SAMPLE = '[extension]\nid = "marie.slugify"\nname = { fr = "Slugify", en = "Slugify" }\ndescription = { fr = "Titre → slug", en = "Title → slug" }\nversion = "0.1.0"\napi = "1"\nlicense = "MIT"\n\n[ui]\nentry = "ui/index.html"\n\n[permissions]\nclipboard = true\n'

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }

function copyBlock(text) {
  return '<div class="copyable"><pre class="o-pre">' + esc(text) + '</pre><button class="o-btn o-btn--sm" data-copy="' + esc(text) + '">' + outilo.t('copy') + '</button></div>'
}

function block(part) {
  var l = outilo.locale
  if (part === '__SDK__') {
    return '<table class="o-table"><thead><tr><th>API</th><th>Permission</th><th></th></tr></thead><tbody>' +
      DevLogic.SDK.map(function (s) { return '<tr><td>' + esc(s[0]) + '</td><td>' + (s[1] || '—') + '</td><td style="white-space:normal;font-family:var(--o-font-ui)">' + SDK_DESC[l][s[2]] + '</td></tr>' }).join('') + '</tbody></table>'
  }
  if (part === '__MCP__') {
    return '<h3>Claude Code</h3>' + copyBlock(DevLogic.mcpConfig('claude-code')) +
      '<h3>Claude Desktop, Cursor, Windsurf</h3>' + copyBlock(DevLogic.mcpConfig('json')) +
      '<h3>VS Code (.vscode/mcp.json)</h3>' + copyBlock(DevLogic.mcpConfig('vscode'))
  }
  if (part === '__CHECK__') {
    return '<div class="o-stack"><textarea class="o-textarea" id="toml" spellcheck="false">' + esc(SAMPLE) + '</textarea>' +
      '<label class="o-check"><input type="checkbox" id="community" checked> ' + outilo.t('community') + '</label><div class="o-panel" id="verdict"></div></div>'
  }
  return part
}

function check() {
  var r = DevLogic.validate($('#toml').value, $('#community').checked)
  var label = function (code) { var k = code.split(':'); return outilo.t(k[0]) + (k[1] ? ' : ' + k[1] : '') }
  $('#verdict').innerHTML = '<p class="' + (r.ok ? 'ok' : 'err') + '"><strong>' + outilo.t(r.ok ? 'valid' : 'invalid') + '</strong></p>' +
    '<ul>' + r.errors.map(function (e) { return '<li class="err">' + esc(label(e)) + '</li>' }).join('') +
    r.warnings.map(function (w) { return '<li>' + esc(label(w)) + '</li>' }).join('') + '</ul>'
}

function render() {
  var pages = PAGES[outilo.locale] || PAGES.fr
  var nav = $('#nav')
  nav.querySelectorAll('button').forEach(function (b) { b.remove() })
  Object.keys(pages).forEach(function (k) {
    var b = document.createElement('button')
    b.textContent = pages[k][0]
    b.className = k === page ? 'on' : ''
    b.addEventListener('click', function () { page = k; render(); window.scrollTo(0, 0) })
    nav.appendChild(b)
  })
  $('#main').innerHTML = pages[page][1].map(block).join('')
  $('#main').querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', async function () {
      await outilo.clipboard.write(b.getAttribute('data-copy'))
      outilo.toast(outilo.t('copied'), 'success')
    })
  })
  if ($('#toml')) {
    $('#toml').addEventListener('input', check)
    $('#community').addEventListener('change', check)
    check()
  }
  outilo.translate()
}

outilo.onLocale(render)
outilo.onCommand(function (cmd) { if (cmd === 'mcp') { page = 'ai'; render() } })
outilo.ready.then(render)
