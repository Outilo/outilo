# CLAUDE.md — Outilo

Boîte à outils de bureau open source (Apache-2.0), Windows en priorité. Tout outil est une extension isolée,
mise à jour indépendamment de l'application.

## Commandes

```bash
npm install
npm run app          # tauri dev (fenêtre native + rechargement à chaud)
npm run dev          # aperçu navigateur sur http://localhost:1420 (sans Tauri, données en localStorage)
npm run typecheck    # vue-tsc
npm test             # tests JS des extensions + cargo test
npm run app:build    # installateur NSIS : src-tauri/target/release/bundle/nsis/
npm run keygen       # clés de signature du registre (clé privée → secret GitHub, jamais dans le dépôt)
npm run mcp          # serveur MCP des développeurs (stdio) : mcp/server.mjs
```

Variables utiles en développement : `OUTILO_NO_LIVE=1` (extensions installées au lieu du dossier du dépôt, pour tester
les mises à jour), `OUTILO_REGISTRY=file:///D:/chemin/index.json` (registre local), `OUTILO_DEV_PUBKEY=<base64>`
(clé de test acceptée en debug uniquement).

## Arborescence

- `src/` — shell Vue 3 + TS (maquette A « Atelier »). État global : `src/lib/store.ts` ; pont iframe ↔ cœur :
  `src/lib/extHost.ts` ; accès Rust (+ repli navigateur) : `src/lib/api.ts` ; i18n : `src/lib/i18n.ts`.
- `src-tauri/src/` — cœur Rust : `manifest.rs` (validation `outilo.toml`), `registry.rs` (amorçage, versions,
  mode dev), `protocol.rs` (protocole `outilo-ext://`, CSP des extensions), `storage.rs`, `theme.rs`, `lib.rs`
  (commandes Tauri), `remote.rs` (registre en ligne : index, vérification, installation, retour arrière),
  `system.rs` / `net.rs` / `cleaner.rs` / `sql.rs` (API des extensions), `updater.rs` (mise à jour de l'application).
- `mcp/server.mjs` — serveur MCP `outilo-mcp` ; s'appuie sur `scripts/lib/` (`validate.mjs` = règles du store,
  `scaffold.mjs` = squelette, `package.mjs` = paquets signés).
- `scripts/` — `release-extensions.mjs` (paquets signés + index, lancé par la CI), `keygen.mjs`, `packs.json`
  (packs d'onboarding). `.github/workflows/` — CI, publication des extensions, installateur, site (manuel).
- `src-tauri/themes/` — thèmes intégrés (`theme.toml`).
- `sdk/` — `outilo-sdk.js`, `outilo-ui.css`, polices ; embarqués dans le binaire et servis sous `/_sdk/`.
- `extensions/` — extensions officielles (voir `extensions/README.md` pour le format et le SDK).
- `tests/extensions/` — tests Node de la logique des extensions.
- `docs/` — cahier des charges et notes de conception. `site/` — site Nextra (ne pas modifier sans demande).
- `maquettes/` — maquettes HTML de référence (A retenue).

## Règles

- Les extensions n'ont **jamais** accès à l'API Tauri : iframe `sandbox="allow-scripts"` sans `allow-same-origin`,
  CSP sans réseau. Toute nouvelle capacité = méthode dans `extHost.ts` + permission dans `manifest.rs`
  (`KNOWN_PERMISSIONS`) + vérification côté Rust (`AppState::require`) si une commande est appelée.
- Aucun droit administrateur ; données uniquement dans `%APPDATA%\Outilo\`.
- Action destructrice (arrêt de processus, suppression) : confirmation **native** dont le texte est rédigé par le
  cœur, jamais par l'extension. Une extension ne choisit jamais un chemin de fichier.
- Publier une extension = monter sa `version` ; une version publiée n'est jamais modifiée.
- Textes de l'interface en FR + EN (`src/lib/i18n.ts`, `outilo.messages` dans les extensions).
- Couleurs via les tokens `--o-*` uniquement.
- Commentaires et messages en français.
