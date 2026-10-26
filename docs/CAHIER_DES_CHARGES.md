# Cahier des charges — Outilo

> Version 0.6 — 26/10/2026 — mise à jour de l'application, 27 extensions, outils développeurs (voir § 12). Organisation GitHub réelle : voir
> `docs/DISTRIBUTION.md` (un seul dépôt `Outilo/outilo` pour l'instant).
> Base : prototype Nuxt interne (<https://toolkit.iducation.fr>, appelé à disparaître)

---

## 1. Contexte

Le prototype actuel est une application web Nuxt 3 / Vue 3 / Tailwind regroupant 21 outils pour développeurs
(mots de passe, faux utilisateurs, JSON, JWT, Base64, hash, crontab, QR code, SQL, ping, factures…), avec favoris,
recherche, catégories, i18n FR/EN et thème clair/sombre.

Limites : tous les outils sont compilés dans l'application (impossible d'en ajouter ou d'en mettre un à jour sans
tout redéployer), certains outils dépendent d'un serveur, thème limité à 6 couleurs d'accent.

## 2. Objectifs

1. **Application de bureau native** (cœur Rust), **Windows en priorité**.
2. **Noyau open source sous licence Apache-2.0**.
3. **Tout outil est une extension**, distribuée et mise à jour **indépendamment** de l'application et des autres
   extensions.
4. Extensions écrites en **TypeScript / JavaScript** ou en **Rust** (via WebAssembly).
5. **Thèmes** entièrement personnalisables, partageables comme des extensions.
6. **Onboarding par profil** (développeur, webdesigner, usage quotidien…) qui pré-installe les bons outils.
7. Documentation exemplaire pour les créateurs d'extensions (README, docs, `CLAUDE.md`, template).

## 3. Décisions actées

| Sujet | Décision |
| --- | --- |
| Nom | **Outilo** (« outil » + o : court, prononçable en français comme en anglais) |
| Domaine | `outilo.xyz` — non enregistré au 25/10/2026 (vérification RDAP), à acheter chez OVH |
| Organisation GitHub | `outilo` — libre au 25/10/2026 |
| Techno | **Tauri 2** (cœur Rust + interface web) — frontend **Vue 3 + TypeScript + Vite** |
| Maquette | **A « Atelier »** (style IDE : barre d'activité, explorateur, onglets, barre d'état) |
| Licence | **Apache-2.0** (noyau, SDK, template, extensions officielles) |
| Plateforme V1 | **Windows 10/11 x64** uniquement (macOS/Linux plus tard, l'architecture reste portable) |
| Langues | Français, anglais |
| Extensions V1 | **Uniquement gratuites** |
| Comptes / paiement | Hors V1, documentés dans `docs/futur/` |
| Public V1 | Usage interne : le porteur du projet et ses collaborateurs (phase de test) |
| Signature de code | Aucune en V1 (avertissement SmartScreen accepté) |
| Communauté | Fermée en V1 : seules les extensions développées par l'équipe sont publiées |
| Stockage | Uniquement dans le profil utilisateur, **jamais de droits administrateur** ; SQLite disponible pour les extensions |
| Distribution | Installateur publié en Release GitHub ; ni Microsoft Store ni winget en V1 |
| Site & documentation | **Nextra** (Next.js, export statique) hébergé sur GitHub Pages, style maquette A |

### Pourquoi Tauri plutôt qu'une UI 100 % Rust

- Les extensions doivent pouvoir être écrites en TypeScript/JavaScript : la WebView les exécute nativement.
- Les thèmes doivent être modifiables « comme on veut » : CSS + variables = liberté totale.
- Le cœur reste en Rust : système de fichiers, réseau, permissions, téléchargements, signatures, exécution WASM.
- Sous Windows, Tauri utilise WebView2 (déjà présent sur Windows 10/11) : installateur d'environ 10 Mo.

## 4. Périmètre

### 4.1 V1

- Application : shell IDE (maquette A), palette de commandes, recherche, favoris, onglets, paramètres, FR/EN.
- Onboarding par profil (choix d'un profil → installation d'un pack d'extensions).
- Gestionnaire d'extensions : parcourir, installer, mettre à jour, désactiver, désinstaller.
- Registre public sur GitHub, mises à jour **extension par extension**.
- 12 à 15 extensions officielles (§ 6).
- Moteur de thèmes + 2 thèmes officiels (Atelier sombre / Atelier clair) + import.
- SDK TypeScript + SDK Rust + template + documentation.
- Mise à jour automatique de l'application (séparée de celle des extensions).
- Installateur Windows (NSIS) non signé, publié en Release GitHub.
- Site de présentation + documentation (Nextra, GitHub Pages).

### 4.2 Plus tard

- macOS, Linux.
- Comptes, synchronisation des préférences (`docs/futur/COMPTES.md`).
- Extensions payantes, marketplace tiers (`docs/futur/MODELE_PAYANT.md`).
- Interface personnalisée par profil (disposition, raccourcis, accueil propres au métier).
- Portage du reste des outils du prototype (SQL, factures, Docker…).

## 5. Exigences fonctionnelles

### 5.1 Application

| ID | Exigence |
| --- | --- |
| F-01 | Accueil : outils récents, favoris, mises à jour disponibles, suggestions. |
| F-02 | Explorateur latéral : favoris, extensions installées, catégories. |
| F-03 | Onglets : plusieurs outils ouverts, état conservé pendant la session. |
| F-04 | Palette de commandes `Ctrl+K` : outils, actions rapides (« copier un UUID »), commandes des extensions. |
| F-05 | Raccourci global **optionnel** (désactivé par défaut, ex. `Alt+Maj+Espace`) pour ouvrir la palette depuis n'importe où ; icône dans la zone de notification. |
| F-06 | Copier en un clic tout résultat ; exports JSON / CSV quand pertinent. |
| F-07 | Paramètres : langue, thème, raccourcis, démarrage avec Windows, canal de mise à jour, télémétrie (désactivée par défaut). |
| F-08 | Hors-ligne complet une fois les extensions installées. |
| F-09 | Barre d'état : état réseau, nombre d'extensions, mises à jour, langue. |

### 5.2 Onboarding par profil

Au premier lancement, l'utilisateur choisit un ou plusieurs profils. Chaque profil correspond à un **pack**
(liste d'extensions) défini dans le registre, donc modifiable sans mettre à jour l'application.

| Profil | Pack proposé |
| --- | --- |
| Développeur | Mots de passe, Utilisateurs fictifs, JSON, JWT, Encodeurs, Hash, UUID, Regex, Timestamps, Ports & processus |
| Webdesigner | Couleurs, Lorem ipsum, QR code, Convertisseur d'images, Mots de passe |
| DevOps / admin | Ports & processus, Réseau, Hash, Cron, Infos système, Nettoyeur |
| Usage quotidien | Nettoyeur, Mots de passe, QR code, Infos système, Minuteur |
| Personnalisé | Choix libre dans la liste |

Le profil est conservé ; il servira plus tard à adapter l'interface au métier.

### 5.3 Extensions (vue utilisateur)

| ID | Exigence |
| --- | --- |
| E-01 | Installer / mettre à jour **une** extension sans toucher à l'application ni aux autres. |
| E-02 | Vérification à chaque lancement (et toutes les 24 h) des nouvelles versions ; mise à jour automatique ou manuelle au choix. |
| E-03 | Retour à la version précédente en un clic (la version N-1 est conservée). |
| E-04 | Permissions affichées avant installation ; nouvelle demande si une mise à jour en ajoute. |
| E-05 | Installation depuis un fichier local (`.outilo`) en mode développeur ; rechargement à chaud. |
| E-06 | Une extension peut fournir : des outils, des commandes de palette, des thèmes. |

## 6. Extensions officielles V1

Toutes vivent dans le dépôt `extensions` de l'organisation et sont des extensions comme les autres.

### 6.1 Développement

| Extension | Contenu |
| --- | --- |
| Mots de passe | Longueur 4–128, jeux de caractères, exclusion ambigus, phrase de passe, entropie, lot |
| Utilisateurs fictifs | Locales FR/EN/DE/ES, choix des champs, lot jusqu'à 10 000, graine, export JSON/CSV/SQL |
| JSON | Formater, minifier, valider, trier les clés, JSON ⇄ YAML |
| JWT | Décoder en-tête/payload, vérifier la signature (HS/RS), expiration lisible |
| Encodeurs | Base64 (texte et fichier), URL, HTML entities, hexadécimal |
| Hash | MD5, SHA-1/256/512, bcrypt, argon2 ; texte et fichier |
| UUID / ULID | Génération v4/v7, ULID, NanoID, en lot |
| Regex | Testeur avec surlignage, groupes, bibliothèque d'exemples |
| Timestamps | Unix ⇄ date, fuseaux horaires, formats ISO / RFC |
| Cron | Expression ⇄ description lisible, prochaines exécutions |

### 6.2 Système et usage quotidien

| Extension | Contenu |
| --- | --- |
| Nettoyeur | Dans le profil utilisateur uniquement (sans droits admin) : `%TEMP%` de l'utilisateur, caches navigateurs, caches dev (npm, pnpm, yarn, cargo, pip), corbeille ; aperçu de l'espace libéré, confirmation obligatoire |
| Ports & processus | « Qui utilise le port 3000 ? », liste des processus, arrêt d'un processus (avec confirmation) |
| Réseau | IP locale/publique, ping, résolution DNS, vider le cache DNS |
| Infos système | OS, CPU, RAM, disques, GPU ; copier un résumé pour un ticket de support |
| Couleurs | Pipette écran, conversions HEX/RGB/HSL/OKLCH, contraste WCAG, palettes |
| QR code | Générer (URL, Wi-Fi, texte), exporter PNG/SVG |
| Lorem ipsum | Paragraphes, phrases, mots, listes |

Les extensions « Système » utilisent des permissions sensibles (§ 7.3) et sont marquées **Vérifiée** car publiées
par l'organisation.

## 7. Architecture technique

### 7.1 Vue d'ensemble

```text
┌─────────────────────── Application Outilo (Tauri 2) ───────────────────────┐
│  Shell Vue 3 (maquette A)   Palette   Onboarding   Gestionnaire d'extensions │
│        │                                                                     │
│        ├── iframe isolée par extension (UI HTML/TS, thème injecté)           │
│        │        ⇅  RPC postMessage (API Outilo, contrôlée par permissions)   │
│  ──────┴──────────────────────── Cœur Rust ───────────────────────────────── │
│  Registre & mises à jour · Vérif. signatures · Permissions · Stockage        │
│  Hôte WebAssembly (wasmtime) · API système (fichiers, processus, réseau)     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Anatomie d'une extension

```text
mon-extension/
├─ outilo.toml        # manifeste
├─ ui/                 # interface (Vue, Svelte, React ou JS pur), compilée en HTML/JS
├─ logic/              # optionnel : code Rust compilé en .wasm
├─ locales/fr.json     # traductions
├─ icon.svg
├─ README.md
└─ CLAUDE.md
```

```toml
[extension]
id = "outilo.password"
name = "Mots de passe"
version = "1.2.0"
api = "1"                 # version de l'API Outilo ciblée
license = "Apache-2.0"
categories = ["securite", "generateur"]

[permissions]
clipboard = "write"
```

- **UI** : page web isolée dans une iframe (CSP stricte, pas d'accès direct à Tauri). Les tokens de thème sont
  injectés en variables CSS ; un kit de composants (`@outilo/ui`) assure la cohérence visuelle.
- **Logique TS/JS** : s'exécute dans l'iframe.
- **Logique Rust** : compilée en WebAssembly, exécutée par le cœur dans `wasmtime`, appelée depuis l'UI.
- **Aucun binaire natif** fourni par une extension : tout accès système passe par l'API Outilo.

### 7.3 API Outilo et permissions

| Permission | Accès | Sensible |
| --- | --- | --- |
| `clipboard` | lire / écrire le presse-papiers | non |
| `storage` | stockage clé/valeur propre à l'extension | non |
| `storage.sql` | base SQLite propre à l'extension (ex. future extension CRM) | non |
| `files.save` | enregistrer un fichier via la boîte « Enregistrer sous » | non |
| `files.pick` | fichiers choisis par l'utilisateur | non |
| `network` | HTTP vers les domaines déclarés | moyen |
| `files.scoped` | lecture/suppression dans des dossiers déclarés **du profil utilisateur** (ex. `%TEMP%`) | **oui** |
| `process` | lister / arrêter des processus | **oui** |
| `system.info` | informations matériel/OS | non |
| `shell.safe` | commandes système prédéfinies par Outilo (ex. `ipconfig /flushdns`) | **oui** |

Les permissions sensibles affichent un avertissement à l'installation ; en V1 elles sont réservées aux extensions
publiées par l'organisation.

### 7.4 Distribution désynchronisée (point clé)

Détail complet : `docs/DISTRIBUTION.md`. En résumé :

- **Organisation GitHub** `outilo` avec les dépôts `outilo`
  (application), `extensions` (monorepo des extensions officielles), `registry` (index), `extension-template`,
  `docs`.
- Dans `extensions`, chaque extension a **sa propre version**. La CI ne construit **que les extensions modifiées**
  et publie une Release par extension (tag `password-v1.2.0`).
- La CI met ensuite à jour l'index du `registry`, publié en JSON statique (GitHub Pages sur
  `registry.outilo.xyz`).
- L'application lit l'index, compare les versions et **télécharge uniquement** les paquets qui ont changé.
- L'application elle-même se met à jour par un canal séparé (updater Tauri, Releases du dépôt `outilo`).
- Plus tard (communauté fermée en V1) : les auteurs externes garderont leur propre dépôt et proposeront leur extension par Pull Request sur `registry`.

### 7.5 Thèmes

- **Niveau 1 — réglages** : clair/sombre/système, couleur d'accent libre, arrondis, densité, polices.
- **Niveau 2 — `theme.toml`** : tous les tokens (couleurs, typo, espacements, rayons, ombres).
- **Niveau 3 — CSS libre** : feuille de style chargée après celle du thème, aucune restriction sur le shell.
- Un thème est une extension sans code (`[theme]` dans le manifeste) : il s'installe et se met à jour via le
  registre.
- Éditeur intégré avec aperçu en direct et export.

### 7.6 Arborescence du dépôt `outilo`

```text
outilo/
├─ src/              # frontend Vue 3 (shell, palette, onboarding, gestionnaire)
├─ src-tauri/        # cœur Rust (commandes Tauri)
├─ crates/
│  ├─ registry/      # index, téléchargements, signatures, versions
│  ├─ runtime/       # hôte wasmtime, API Outilo, permissions
│  └─ theme/         # theme.toml → variables CSS
├─ packages/
│  ├─ sdk/           # @outilo/sdk (TypeScript)
│  └─ ui/            # @outilo/ui (composants)
├─ docs/
├─ CLAUDE.md
└─ LICENSE           # Apache-2.0
```

## 8. Exigences non fonctionnelles

| Domaine | Cible |
| --- | --- |
| Démarrage à froid | < 1 s |
| Installateur | < 15 Mo (hors extensions) |
| Mémoire au repos | < 150 Mo |
| OS | Windows 10 22H2+ et Windows 11, x64 (ARM64 plus tard) |
| Sécurité | Paquets signés (ed25519), hash SHA-256 vérifié, iframes isolées, permissions explicites |
| Vie privée | Aucune télémétrie sans accord ; seules requêtes réseau : index du registre et téléchargements |
| Accessibilité | Clavier complet, contraste WCAG AA, `prefers-reduced-motion` |
| i18n | FR + EN ; extensions traduisibles |
| Qualité | Tests unitaires (logique des outils), E2E du shell, clippy/rustfmt/eslint en CI |

## 9. Documentation à produire

- `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE`.
- `CLAUDE.md` à la racine de chaque dépôt et dans le template.
- Site `outilo.xyz/docs` : guide utilisateur, « créer une extension en 10 min » (TS et Rust), référence de l'API
  et des permissions, référence des tokens de thème, guide de publication.
- `docs/DISTRIBUTION.md` (registre et mises à jour).
- `docs/futur/MODELE_PAYANT.md`, `docs/futur/COMPTES.md`.

## 10. Jalons

| Jalon | Contenu |
| --- | --- |
| J0 | Validation v0.2, création de l'organisation GitHub, achat du domaine |
| J1 | Squelette Tauri + shell maquette A + moteur de thèmes + i18n |
| J2 | Runtime d'extensions (iframe + RPC + permissions + WASM) + SDK TS/Rust |
| J3 | Registre, CI de publication, gestionnaire d'extensions, mises à jour indépendantes |
| J4 | Extensions officielles (dev puis système) + onboarding |
| J5 | Installateur non signé, auto-update, site → **V1 interne** (tests équipe) |

## 11. Questions ouvertes

Voir la conversation.

## 12. État d'avancement — v0.6

| Élément | État |
| --- | --- |
| Shell, palette, onboarding, FR / EN, thèmes, runtime isolé, permissions | fait (v0.4) |
| Registre en ligne signé, mises à jour par extension, retour arrière, CI de publication | fait (v0.5) |
| Premier lancement : choix des outils à installer ; catalogue hors ligne du pack embarqué | fait |
| Mise à jour de l'application : détection au lancement, bandeau, installation signée, option automatique | fait |
| Nouvelle icône (clé mixte : œil hexagonal en « O ») | fait |
| `storage.sql` (SQLite privée par extension) | fait |
| 27 extensions : les 21 outils du prototype couverts (§ 6 + Texte, Markdown, Docker, Minuteur, SQL, Notes, Factures, Images, JavaScript) | fait |
| Serveur MCP `outilo-mcp` (créer, valider, tester, relier, empaqueter, proposer) | fait |
| Bac à sable développeur : rechargement à chaud, journal d'API, actions système simulées | fait |
| Extension Doc développeur, guide `docs/EXTENSIONS_COMMUNAUTE.md`, CI des propositions | fait |
| `files.pick`, logique WebAssembly | à faire |
| Publication npm de `@outilo/mcp` (compte npm de l'équipe) | à faire (optionnel) |
| Utilisateurs fictifs DE / ES et lots de 10 000 ; Hash : argon2 | à faire |

Écart par rapport à la conception : le SDK est un script global (`window.outilo`, servi sous `/_sdk/`) plutôt qu'un
paquet npm `@outilo/sdk`, pour que les extensions restent du HTML/JS sans étape de build. La documentation du site
sera alignée lors de sa mise en ligne.
