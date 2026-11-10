# Validation de la livraison 1.2.0

Vérifications du 10 novembre 2026 : TypeScript, ESLint, compilation, **64 tests Vitest** et **51 scénarios Playwright** sur Chromium, Firefox et WebKit.

- Anglais et son actifs par défaut, migration des anciens réglages, choix français/anglais et silence volontaire conservés après rechargement.
- Changement de langue sans relancer la partie, sans modifier la pause ni effacer les réglages en cours de saisie ; victoire, bonus, statistiques et captures traduits.
- Sélecteur visible en haut à droite à 320 et 390 pixels, aucune barre de défilement horizontale ; captures anglaises et françaises inspectées.
- Statistiques en direct avant la première victoire, courbe et durée progressant pendant la partie et stables pendant la pause ; résultat enregistré une seule fois puis conservé après rechargement.
- Régressions corrigées : disparition définitive du camp à zéro case, et arrêt de la collecte sur un ancien trajet après téléportation.
- Règles 1.0.1 : les résultats historiques 1.0.0 sont conservés pour les compteurs, leur rejeu reste désactivé.
- Ajustement des paramètres par défaut après simulation : 600 parties complètes, moyenne 8 min 21 s simulées (2 min 05 s à ×4). Une série indépendante de 300 graines confirme le rythme. Les quantiles, parties longues et données brutes sont dans la [mesure des durées](DUREES.md).
- Test de rejeu d’une partie 1.0.1 avec les anciens paramètres explicites : même victoire à la même étape 45 344, malgré le changement des valeurs par défaut.

Les tests de son vérifient la reprise du contexte audio après un geste autorisé et la coupure du gain maître. Les règles d’autoplay du navigateur peuvent exiger un premier clic ou toucher ; l’interface garde alors le son activé en attente de ce geste.

## Validation historique de la version 1.1.0

Vérifications effectuées le 9 novembre 2026.

## Fonctionnement

- TypeScript, ESLint et compilation Vite : réussis.
- **50 tests Vitest** : règles, bonus, collisions, sauvegarde et partage.
- Robustesse : **200 graines pendant 120 secondes simulées**, invariants de terrain, vitesses et entités contrôlés.
- Une partie fidèle complète a été vérifiée avec la graine 1 : victoire à 377,87 secondes. Les parties n’ont pas de limite de durée et ne reproduisent pas la durée exacte de la vidéo.
- **30 tests Playwright** : 10 scénarios sur Chromium, Firefox et WebKit. Ils couvrent notamment une vraie victoire, son enregistrement unique, la pause, le rejeu, les réglages, le stockage refusé, le partage, le PNG et les dimensions mobiles/paysage.
- L’historique conserve 100 résultats rejouables et la courbe détaillée de la dernière partie, afin de rester compact.

## Vérification visuelle

Affichage ordinateur et téléphone simulé, trois thèmes, état avec plusieurs bonus actifs, export et écran de victoire inspectés. Les références visuelles sont des captures locales de la vidéo fournie ; la vidéo n’est pas publiée.

Le rendu ne modifie pas la simulation. Vingt rendus successifs avec un temps écoulé nul produisent une image identique, vérifiant la stabilité de la pause.

## Mesure de charge

Hôte de mesure : Windows x64, Intel Core i7-10700 à 2,90 GHz, 16 Gio de mémoire, Chromium headless 158.0.8127.18.

Scénario : terrain 30 × 40, 14 billes et 14 effets, rendu DPR 2, 300 images avec deux pas de simulation par image. Temps CPU simulation + rendu : médiane **0,30 ms**, 95e percentile **0,50 ms**, maximum **0,80 ms**.

Il s’agit de temps CPU hors synchronisation écran, pas d’une mesure du débit réel du GPU. L’objectif de 60 images/s sur téléphone reste à mesurer sur appareil physique. Les tests WebKit et les dimensions mobiles ne constituent pas une validation sur iPhone ou Android réel.

## Publication

Le workflow GitHub Actions rejoue les vérifications sur Linux avant chaque déploiement de `main`. Les résultats de cette exécution distante sont consultables dans l’onglet Actions du dépôt. Une erreur de test empêche le déploiement.
