# Modèle payant (hors V1)

> Statut : mis de côté. La V1 ne propose que des extensions gratuites. Ce document fixe les principes pour que
> l'architecture V1 ne bloque pas cette évolution.

## 1. Principes

- Le noyau, le SDK et les extensions officielles gratuites restent sous licence Apache-2.0.
- Des extensions payantes pourront être publiées par l'éditeur, puis par des auteurs tiers.
- Le registre distingue `price` / `license_required` dans l'index ; la V1 ignore simplement ces champs.

## 2. Étapes envisagées

| Étape | Contenu | Prérequis |
| --- | --- | --- |
| P1 | Extensions payantes de l'éditeur | Comptes (`COMPTES.md`), Merchant of Record, serveur de licences |
| P2 | Pack Pro / abonnement | Gestion des renouvellements |
| P3 | Marketplace tiers | Reversement aux auteurs, modération, conditions générales vendeurs |

## 3. Vente et fiscalité

Passer par un **Merchant of Record** (Lemon Squeezy, Paddle ou Polar) : il encaisse, gère la TVA européenne et
mondiale, émet les factures. Pour la marketplace tiers : Stripe Connect ou Polar (reversements aux auteurs).
Commission plateforme à définir (référence du marché : 15 à 30 %).

## 4. Licences

- À l'achat, le serveur émet un **jeton de licence signé** (ed25519) : identifiant de l'extension, compte,
  nombre de machines, date d'expiration éventuelle.
- L'application vérifie le jeton **hors-ligne** avec la clé publique embarquée.
- Les paquets payants ne sont **pas** sur des Releases GitHub publiques : téléchargement via une URL signée à durée
  limitée, délivrée sur présentation du jeton.

## 5. Limite à assumer

Dans une application open source, toute vérification côté client peut être contournée. Le modèle doit reposer sur
la valeur apportée (mises à jour, support, services en ligne, confort) plutôt que sur la protection technique.

## 6. Modèles possibles

- Achat unique par extension (avec 1 an de mises à jour).
- Pack Pro (ensemble d'extensions premium).
- Abonnement (toutes les extensions premium + synchronisation).
- Extensions gratuites avec option « soutenir l'auteur » (dons).
