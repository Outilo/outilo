# Extensions officielles Outilo

Chaque dossier est une extension indépendante, avec sa propre version. Elles sont embarquées dans l'installateur
(pack de départ) et copiées au premier lancement dans `%APPDATA%\Outilo\extensions\<id>\<version>\`. Ensuite, chaque
extension est mise à jour **seule** depuis le registre en ligne (voir `docs/DISTRIBUTION.md`) ; la version précédente
est conservée pour le retour arrière.

Publier une nouvelle version : modifier le dossier, monter `version` dans `outilo.toml`, pousser sur `main`. La CI
signe le paquet, crée la Release `<dossier>-v<version>` et met à jour l'index ; les applications installées le voient
au lancement suivant (ou via « Vérifier les mises à jour »).

| Dossier | Identifiant | Permissions |
| --- | --- | --- |
| `password` | `outilo.password` | clipboard, storage |
| `fake-user` | `outilo.fake-user` | clipboard, storage, files.save |
| `jwt` | `outilo.jwt` | clipboard |
| `uuid` | `outilo.uuid` | clipboard |
| `json` | `outilo.json` | clipboard, storage, files.save |
| `encoders` | `outilo.encoders` | clipboard, storage |
| `hash` | `outilo.hash` | clipboard |
| `regex` | `outilo.regex` | clipboard, storage |
| `timestamps` | `outilo.timestamps` | clipboard |
| `cron` | `outilo.cron` | clipboard, storage |
| `lorem` | `outilo.lorem` | clipboard |
| `colors` | `outilo.colors` | clipboard, storage |
| `qr` | `outilo.qr` | clipboard, files.save |
| `sysinfo` | `outilo.sysinfo` | system.info, clipboard, files.save |
| `network` | `outilo.network` | network (`*`), shell.safe, clipboard |
| `ports` | `outilo.ports` | process |
| `cleaner` | `outilo.cleaner` | files.scoped |
| `text` | `outilo.text` | clipboard, storage |
| `markdown` | `outilo.markdown` | clipboard, storage, files.save |
| `docker` | `outilo.docker` | clipboard, files.save |
| `timer` | `outilo.timer` | aucune |
| `sql` | `outilo.sql` | storage, storage.sql, clipboard, files.save |
| `notes` | `outilo.notes` | storage.sql, clipboard, files.save |
| `invoice` | `outilo.invoice` | storage, files.save |
| `image` | `outilo.image` | clipboard, files.save |
| `jsrun` | `outilo.jsrun` | storage |
| `devdocs` | `outilo.devdocs` | clipboard |

Bibliothèques embarquées (dans `ui/vendor/`, licences jointes) : js-yaml (MIT) pour JSON et Docker, bcryptjs
(BSD-3) pour Hash, qrcode-generator (MIT) pour QR code, marked (MIT) pour Markdown, smol-toml (BSD-3) pour la doc
développeur.

**Extensions tierces** : voir [`docs/EXTENSIONS_COMMUNAUTE.md`](../docs/EXTENSIONS_COMMUNAUTE.md) (serveur MCP pour
les assistants IA, bac à sable, proposition au store).

## Structure

```text
mon-outil/
├─ outilo.toml      # manifeste
├─ icon.svg
└─ ui/
   ├─ index.html    # charge /_sdk/outilo-ui.css et /_sdk/outilo-sdk.js
   ├─ vendor/       # bibliothèques tierces éventuelles, avec leur licence
   ├─ logic.js      # logique pure, testée dans tests/extensions/
   └─ main.js       # interface
```

Pas d'étape de build : HTML/CSS/JS simples. Une extension peut aussi utiliser Vite/TypeScript tant que `[ui].entry`
pointe vers le HTML compilé.

## Manifeste `outilo.toml`

```toml
[extension]
id = "acme.slugify"                                   # auteur.nom, minuscules
name = { fr = "Slugify", en = "Slugify" }             # ou name = "Slugify"
description = { fr = "…", en = "…" }
version = "0.1.0"                                     # semver
api = "1"                                             # API Outilo ciblée
license = "Apache-2.0"
categories = ["texte"]                                # securite, generateur, donnees, code, texte, reseau, systeme, design
icon = "icon.svg"

[ui]
entry = "ui/index.html"

[[commands]]                                          # apparaît dans la palette Ctrl+K
id = "copy"
title = { fr = "Copier un slug", en = "Copy a slug" }

[permissions]
clipboard = true
```

Permissions reconnues par l'API 1. Une permission inconnue rend le manifeste invalide.

| Permission | Sensible | État |
| --- | --- | --- |
| `clipboard`, `storage`, `files.save` | non | implémentées |
| `system.info` | non | implémentée |
| `network = ["api.exemple.com", "*.exemple.org"]` | moyen | implémentée ; liste de domaines obligatoire (`"*"` : tous) |
| `process` | oui | implémentée (lister, ports, arrêter après confirmation) |
| `files.scoped` | oui | implémentée pour le nettoyeur (liste fixe de caches du profil) |
| `shell.safe` | oui | implémentée : vider le cache DNS |
| `storage.sql` | non | implémentée : base SQLite privée (50 Mo, `ATTACH` interdit). Si `storage` est aussi déclaré : `"storage.sql" = true` |
| `files.pick` | — | réservée, pas encore d'API |

## SDK (`window.outilo`)

L'extension tourne dans une iframe `sandbox="allow-scripts"` servie par `http://outilo-ext.localhost/<id>/…`, sans
réseau (`connect-src 'none'`) ni accès à Tauri. Tout passe par le SDK, et chaque appel est vérifié contre le manifeste.

| API | Permission | Effet |
| --- | --- | --- |
| `outilo.ready` | — | Promesse résolue quand thème et langue sont appliqués |
| `outilo.locale`, `outilo.mode` | — | `fr`/`en`, `dark`/`light` |
| `outilo.messages = { fr: {…}, en: {…} }` | — | Traductions ; `data-i18n="clé"` sur les éléments, `outilo.t('clé', {n: 2})` en JS |
| `outilo.clipboard.write(texte)` | clipboard | Écrit dans le presse-papiers |
| `outilo.storage.get/set/remove/keys` | storage | Clé/valeur JSON privé, 5 Mo max |
| `outilo.files.save(nom, contenu, { encoding })` | files.save | Boîte « Enregistrer sous » ; résout `true` si enregistré. Binaire : contenu base64 et `{ encoding: 'base64' }` |
| `outilo.sql.query(sql, params)`, `.exec(script)` | storage.sql | SQLite ; `{ columns, rows, changes, truncated }`, BLOB en `{ $blob: base64 }` |
| `outilo.system.info()` | system.info | OS, CPU, mémoire, disques, cartes graphiques, interfaces |
| `outilo.net.fetch(url, { method, headers, body })` | network | HTTP(S) vers un domaine déclaré ; `{ status, headers, body, ms }` (5 Mo max) |
| `outilo.net.lookup(hôte)`, `.tcp(hôte, port, ms)`, `.ping(hôte, n)`, `.interfaces()` | network | Diagnostic réseau (ping ICMP sans droits admin) |
| `outilo.process.list()`, `.ports()`, `.kill(pid)` | process | `kill` affiche une confirmation Windows rédigée par Outilo |
| `outilo.clean.scan()`, `.run(ids)` | files.scoped | Caches connus du profil ; `run` demande confirmation, résout `null` si annulé |
| `outilo.shell.flushDns()` | shell.safe | Équivalent de `ipconfig /flushdns` |
| `outilo.toast(message, 'info'\|'success'\|'error')` | — | Notification du shell |
| `outilo.onCommand(cb)` | — | Reçoit l'`id` d'une `[[commands]]` lancée depuis la palette |
| `outilo.onLocale(cb)`, `outilo.onTheme(cb)` | — | Changement de langue / de thème |

Composants CSS (`/_sdk/outilo-ui.css`) : `o-panel`, `o-btn`, `o-btn--primary`, `o-btn--sm`, `o-input`, `o-select`,
`o-textarea`, `o-chip` (`.on`), `o-check`, `o-out`, `o-pre`, `o-meter`, `o-table`, `o-label`, `o-sub`, `o-row`,
`o-stack`, `o-grid`. Couleurs : uniquement les variables `--o-*` du thème.

## Développer une extension

1. Paramètres → activer le **mode développeur**.
2. Extensions → **Charger un dossier…** → choisir le dossier contenant `outilo.toml`.
3. L'extension se recharge dès qu'un fichier change. Extensions → **Bac à sable** : journal des appels d'API et
   simulation des actions système (arrêt de processus, nettoyage, cache DNS).

Tests de la logique : `npm test` (fichiers `tests/extensions/*.test.mjs`).
