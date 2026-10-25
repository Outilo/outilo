# Outilo

La boîte à outils extensible pour Windows : mots de passe, JSON, hash, regex, ports, nettoyeur… dans une application native
légère, où **chaque outil est une extension** isolée et mise à jour séparément.

> Version 0.5 — usage interne (tests). Installateur non signé : Windows SmartScreen affiche un avertissement
> (« Informations complémentaires » → « Exécuter quand même »). Téléchargement : onglet *Releases* du dépôt.

## Contenu de la v0.5

- Shell style IDE : barre d'activité, explorateur (favoris, catégories), onglets, barre d'état, palette `Ctrl+K`.
- Onboarding par profil (développeur, webdesigner, DevOps, usage quotidien).
- **Registre en ligne** : chaque extension est mise à jour seule (paquets signés), automatiquement ou à la demande,
  avec retour à la version précédente. Aucun droit administrateur, tout reste dans `%APPDATA%\Outilo\`.
- 17 extensions : Mots de passe, Utilisateurs fictifs, JWT & Base64, UUID, JSON, Encodeurs, Hash, Regex,
  Timestamps, Cron, Lorem ipsum, Couleurs, QR code, Infos système, Réseau, Ports & processus, Nettoyeur.
- Raccourci global `Alt+Maj+Espace` et zone de notification (désactivés par défaut).
- Thèmes : Atelier sombre / clair, accent, arrondis, CSS personnalisé, import / export `theme.toml`.
- Français / anglais.

## Développement

Prérequis : Node 22+, Rust stable, Visual Studio Build Tools (C++), WebView2 (inclus dans Windows 10/11).

```bash
npm install
npm run app        # application en mode développement
npm test           # tests des extensions + du cœur Rust
npm run app:build  # installateur dans src-tauri/target/release/bundle/nsis/
```

Publication : voir [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md) (extensions publiées par la CI à chaque montée
de version, installateur sur un tag `v*`).

Créer une extension : voir [`extensions/README.md`](extensions/README.md).
Conception : [`docs/CAHIER_DES_CHARGES.md`](docs/CAHIER_DES_CHARGES.md).

## Licence

[Apache-2.0](LICENSE). Polices Inter et JetBrains Mono : SIL Open Font License (`sdk/fonts/`).
