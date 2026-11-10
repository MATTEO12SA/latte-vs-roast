# Durée des parties — mesure du 10 novembre 2026

Objectif demandé : environ dix minutes de **simulation** en moyenne, soit deux minutes trente d’observation à ×4, sans pause. La durée affichée par le jeu et enregistrée dans les statistiques reste celle de la simulation.

## Méthode

Le script `npm run simulate` exécute le vrai moteur TypeScript, avec le pas fixe de 1/120 seconde, les onze bonus et des graines déterministes. Il ne dessine aucune image et ne change ni la physique ni l’aléatoire. Une limite de mesure de 7 200 secondes évite un calcul sans fin ; elle n’est pas une limite imposée dans le jeu. Une partie non terminée à cette limite est signalée comme censurée, jamais comptée comme une victoire.

La première série compare les paramètres sur les graines 1 à 300. Une deuxième série, avec les graines 10 001 à 10 300, valide le réglage retenu indépendamment de la série d’ajustement. Les [résultats complets par graine](durations-1.2.0.json) sont conservés pour reproduction.

## Résultats

| Configuration | Parties terminées | Durée moyenne simulée | Moyenne à ×4 |
| --- | --- | --- | --- |
| Départ : 8 cases/s, bonus toutes les 3 s | 275/300 ; 25 encore actives après 2 h | Au moins 44 min 36 s sur l’ensemble ; 37 min 45 s sur les seules parties terminées | Au moins 11 min 09 s |
| Réglage : 11 cases/s, bonus toutes les 2 s | 300/300 | 8 min 35 s | 2 min 09 s |
| Validation sur 300 autres graines, même réglage | 300/300 | 8 min 07 s | 2 min 02 s |
| **Réglage retenu, deux séries réunies** | **600/600** | **8 min 21 s** | **2 min 05 s** |

La moyenne initiale réelle n’est pas connue : les 25 parties censurées ont continué au-delà du plafond. La valeur de 44 min 36 s est donc une borne inférieure, calculée en comptant ces parties au plafond de mesure.

Pour les 600 parties avec le réglage retenu :

- Médiane : **5 min 45 s** simulées, soit **1 min 26 s** à ×4.
- 90 % terminées en **18 min 50 s** simulées, soit **4 min 43 s** à ×4.
- 95 % terminées en **24 min 58 s** simulées, soit **6 min 15 s** à ×4.
- Plus longue observée : **45 min 43 s**, soit **11 min 26 s** à ×4.
- 304 victoires Crème / Latte et 296 victoires Café / Roast.

Il s’agit de mesures empiriques, pas d’une garantie de durée maximale pour chaque graine. Le terrain 18 × 24, le seuil de 90 %, les onze bonus et leurs effets restent identiques. Les vitesses ×0,5 à ×4 ne modifient pas les résultats. Le profil Personnalisé peut produire des durées différentes.

## Reproduire

```sh
npm run simulate -- --count 300 --first-seed 1 --output .local/durations-tuning.json
npm run simulate -- --count 300 --first-seed 10001 --output .local/durations-validation.json
npm run simulate -- --count 300 --config '{"baseSpeed":8,"spawnSeconds":3}' --output .local/durations-baseline.json
```

Les nouveaux paramètres par défaut sont enregistrés dans chaque lien partagé et chaque résultat. Les anciens liens valides sous les règles 1.0.1 gardent leurs paramètres explicites et restent reproductibles ; le réglage du rythme ne nécessite donc pas une nouvelle version du moteur. Les anciennes règles 1.0.0 restent incompatibles avec les corrections de physique de 1.0.1.
