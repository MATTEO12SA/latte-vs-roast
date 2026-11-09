# Validation de la livraison 1.1.0

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
