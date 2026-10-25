# Système de comptes (hors V1)

> Statut : mis de côté. La V1 fonctionne entièrement sans compte. Ce document prépare l'évolution.

## 1. Pourquoi des comptes plus tard

- Acheter et restaurer des extensions payantes (`MODELE_PAYANT.md`).
- Synchroniser préférences, thèmes, favoris et liste d'extensions entre plusieurs PC.
- Publier des extensions et suivre leurs statistiques (auteurs).
- Noter et commenter les extensions.

## 2. Principes

- **Toujours facultatif** : l'application et les extensions gratuites restent utilisables sans compte.
- Connexion par navigateur (OAuth 2.0 + PKCE, redirection `outilo://auth`) : l'application ne voit jamais le mot
  de passe.
- Fournisseurs envisagés : GitHub (naturel pour les auteurs), e-mail par lien magique, Google.
- Jetons stockés dans le gestionnaire d'identifiants Windows (Credential Manager).

## 3. Données synchronisées

| Donnée | Synchronisée | Remarque |
| --- | --- | --- |
| Liste des extensions installées | oui | réinstallation automatique sur un nouveau PC |
| Thème et réglages | oui | |
| Favoris, profil d'onboarding | oui | |
| Données internes des extensions | au choix de l'extension | opt-in déclaré dans le manifeste |
| Historique (mots de passe générés…) | **jamais** | |

## 4. Backend envisagé

Service léger (API + base Postgres) : comptes, licences, synchronisation, statistiques auteurs. Hébergement à
définir. Conformité RGPD : export et suppression du compte depuis l'application.
