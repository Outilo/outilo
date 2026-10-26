# Créer et proposer une extension (développeurs)

Toute personne peut écrire une extension pour Outilo et la proposer au **store** (le registre affiché dans
Extensions → « Disponibles »). L'équipe Outilo relit chaque proposition avant publication.

## 1. Avec un assistant IA (serveur MCP)

Le serveur MCP `outilo-mcp` donne à votre assistant (Claude, Cursor, VS Code…) les outils pour créer, tester et
proposer une extension. Configuration (Node 22+ requis) :

```json
{
  "mcpServers": {
    "outilo": { "command": "npx", "args": ["-y", "-p", "github:Outilo/outilo", "outilo-mcp"] }
  }
}
```

Avec Claude Code : `claude mcp add outilo -- npx -y -p github:Outilo/outilo outilo-mcp`

| Outil | Rôle |
| --- | --- |
| `outilo_guide` | Documentation complète (manifeste, permissions, SDK, composants) |
| `outilo_create_extension` | Squelette prêt à l'emploi (+ `CLAUDE.md` pour guider l'IA) |
| `outilo_validate_extension` | Mêmes règles que la CI des propositions |
| `outilo_test_extension` | Lance les tests `tests/*.test.mjs` |
| `outilo_link_extension` / `outilo_unlink_extension` | Relie le dossier au bac à sable d'Outilo |
| `outilo_package_extension` | Paquet `.outilo` (non signé) |
| `outilo_submit_extension` | Ouvre la Pull Request de proposition (CLI `gh` connectée ; l'IA doit vous demander confirmation) |

Exemple de demande : « Crée une extension Outilo qui convertit des unités (longueurs, poids, températures), teste-la,
relie-la à Outilo, puis propose-la. »

## 2. Bac à sable

1. Outilo → Paramètres → **Mode développeur**.
2. Reliez le dossier (`outilo_link_extension`) ou Extensions → **Charger un dossier…**.
3. L'extension porte le badge « Développement » et se **recharge à chaque modification**.
4. Extensions → **Bac à sable** : journal de tous les appels d'API (méthode, durée, erreurs) et simulation des actions
   système (arrêt de processus, nettoyage, cache DNS) : rien n'est réellement exécuté tant que la case est cochée.

## 3. Règles du store

- Identifiant `auteur.nom` en minuscules ; le préfixe `outilo.` est réservé à l'équipe.
- Aucune ressource externe : bibliothèques dans `ui/vendor/` avec leur licence ; pas de CDN ni de police en ligne.
- Permissions au plus juste. Réservées aux extensions officielles : `process`, `files.scoped`, `shell.safe`, et
  `network = ["*"]` (déclarez la liste précise des domaines).
- Textes en français et en anglais, couleurs via les variables `--o-*`.
- Licence libre indiquée dans `[extension].license`. 30 Mo maximum.
- Toute nouvelle version : monter `version` ; une version publiée n'est jamais modifiée.

## 4. Proposer sans IA

1. Forkez `Outilo/outilo`, ajoutez votre extension dans `extensions/<identifiant>/`.
2. Vérifiez : `node scripts/check-extensions.mjs extensions/<identifiant>`.
3. Ouvrez une Pull Request. La CI « Propositions d'extensions » vérifie le manifeste, les règles et les tests.
4. Après relecture et fusion, le workflow « Extensions » signe le paquet et le publie : il apparaît dans le catalogue
   de toutes les installations d'Outilo, avec le badge « Communauté ».
