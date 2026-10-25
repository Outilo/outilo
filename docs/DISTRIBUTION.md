# Distribution des extensions et mises à jour

Objectif : mettre à jour **une** extension sans rebuild ni re-téléchargement de l'application ou des autres
extensions.

## 1. Organisation GitHub (état v0.5)

Organisation : [`Outilo`](https://github.com/Outilo). Tout est public (open source, testable par les collaborateurs
sans droits d'administration).

| Élément | Rôle |
| --- | --- |
| Dépôt `Outilo/outilo`, branche `main` | Application, SDK, extensions officielles (`extensions/`), CI |
| Releases `<dossier>-v<version>` (ex. `password-v1.2.0`) | Un paquet signé `.outilo` par version d'extension |
| Releases `v<version>` (ex. `v0.5.0`) | Installateur Windows de l'application |
| Branche `registry` du même dépôt | `index.json`, écrit uniquement par la CI |

URL lue par l'application : `https://raw.githubusercontent.com/Outilo/outilo/registry/index.json` (constante
`remote::DEFAULT_URL`, remplaçable par la variable d'environnement `OUTILO_REGISTRY`, y compris `file:///…` pour les
tests). Le passage à un domaine (`registry.outilo.xyz`) ou à un dépôt `registry` séparé ne demandera que de changer
cette URL.

### Pourquoi un seul dépôt pour l'instant

- SDK, extensions, tests et CI évoluent ensemble ; une seule revue, un seul `npm ci`.
- Chaque dossier d'extension garde **sa propre version** : la CI ne publie que les versions absentes de l'index.
- La branche `registry` évite un jeton d'accès à un second dépôt (le `GITHUB_TOKEN` suffit).
- Une extension pourra être sortie dans son propre dépôt plus tard : seule l'URL dans l'index change.

## 2. Cycle de publication d'une extension officielle

1. Modification dans `extensions/password/` et montée de `version` dans `outilo.toml`.
2. Push sur `main` → workflow `.github/workflows/extensions.yml`.
3. `scripts/release-extensions.mjs` compare chaque extension à l'index : seules les versions nouvelles sont
   empaquetées (`outilo.password-1.2.0.outilo`, zip reproductible), hachées (SHA-256) et signées (ed25519, secret
   `OUTILO_SIGNING_KEY`).
4. Création de la Release `password-v1.2.0` avec le paquet.
5. Commit de `index.json` sur la branche `registry`.

Sans le secret `OUTILO_SIGNING_KEY`, le workflow se contente d'un avertissement. L'application n'est **jamais**
reconstruite pour une mise à jour d'extension. Une version publiée n'est jamais modifiée : pour corriger, on publie
la suivante.

### Clé de signature

- Génération : `npm run keygen` (dans un terminal à part) → fichier `.pem` (clé privée) + clé publique affichée.
- La clé privée va dans le secret GitHub `OUTILO_SIGNING_KEY`, et une copie dans un gestionnaire de mots de passe.
- La clé publique va dans `src-tauri/keys/registry.pub` (une par ligne : on peut en ajouter une nouvelle avant de
  retirer l'ancienne, pour changer de clé sans casser les installations).
- Une application sans clé publique refuse toute installation en ligne (message dans l'écran Extensions).

## 3. Format de l'index (`schema: 1`)

```json
{
  "schema": 1,
  "generated": "2026-10-25T18:00:00Z",
  "extensions": {
    "outilo.password": {
      "name": { "fr": "Mots de passe", "en": "Passwords" },
      "description": { "fr": "…", "en": "…" },
      "categories": ["securite", "generateur"],
      "versions": {
        "1.2.0": {
          "api": "1",
          "url": "https://github.com/Outilo/outilo/releases/download/password-v1.2.0/outilo.password-1.2.0.outilo",
          "sha256": "…",
          "signature": "… (base64, ed25519 sur les octets du paquet)",
          "permissions": ["clipboard", "storage"],
          "size": 48213
        }
      }
    }
  },
  "packs": { "dev": ["outilo.password", "outilo.json"] }
}
```

La version proposée est la plus haute dont `api` est supportée par l'application. Les **packs d'onboarding**
viennent de `scripts/packs.json` et sont publiés dans l'index : on peut les modifier sans publier l'application.

## 4. Côté application

1. Au lancement puis toutes les 24 h : `GET index.json` avec `If-None-Match` (cache local
   `%APPDATA%\Outilo
egistry-cache.json`, utilisé hors ligne).
2. Pour chaque extension : mise à jour proposée si la version du registre est plus récente et compatible.
3. Mise à jour automatique (réglage activé par défaut) **sauf** si la nouvelle version demande des permissions
   supplémentaires : l'utilisateur doit alors cliquer « Accepter et mettre à jour ».
4. Téléchargement du seul paquet concerné (30 Mo max), vérification SHA-256 + signature, décompression protégée
   (chemins, taille), contrôle que le manifeste correspond à l'identifiant et à la version attendus.
5. Installation dans `%APPDATA%\Outilo\extensions\<id>\<version>\` puis bascule ; N-1 conservée.
6. Rechargement de l'onglet de l'extension, sans redémarrer l'application.
7. « Revenir à x.y.z » supprime la version courante et l'écarte : elle n'est plus réinstallée automatiquement.

## 5. Extensions de la communauté (fermé en V1)

En V1, seules les extensions de l'équipe sont publiées. Processus prévu pour l'ouverture :

1. L'auteur part du template, développe dans **son propre dépôt**.
2. L'action GitHub `outilo/publish-action` construit et publie une Release dans son dépôt.
3. Il ouvre une Pull Request sur `registry` ajoutant `extensions/<id>.json`.
4. La CI de `registry` vérifie : manifeste valide, téléchargement OK, hash, permissions non sensibles, licence.
5. Revue humaine puis merge → l'extension apparaît dans l'application.

Les permissions sensibles (`files.scoped`, `process`, `shell.safe`) sont réservées aux extensions officielles en V1.

## 6. Mise à jour de l'application

Canal indépendant. **v0.5** : pousser un tag `v0.5.0` déclenche `.github/workflows/app.yml`, qui construit
l'installateur NSIS (non signé) et l'attache à la Release `v0.5.0` ; les testeurs le téléchargent à la main.
**Prévu** : plugin updater de Tauri, manifeste signé `latest.json` dans les Releases (seconde clé, propre à Tauri).
Une nouvelle version de l'application n'est nécessaire que si le shell ou l'API Outilo change. L'API est
versionnée (`api = "1"`) : une application qui ne connaît pas l'API d'une extension ne l'installe pas.
