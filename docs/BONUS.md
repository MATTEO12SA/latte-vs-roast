# Audit des onze bonus — version 1.3.0

Audit du 10 novembre 2026, règles **1.1.0**. L’objectif est une hiérarchie lisible et des effets fiables : chaque bonus garde son rôle, sans chercher à leur donner tous la même puissance. Aucun bonus n’a été ajouté ni supprimé.

## Rôle et comportement attendu

| Bonus | Rôle | Comportement vérifié |
| --- | --- | --- |
| Fantôme d’éclipse | Percée puissante | Rayon à 40 %, traverse et peint pendant 6 s ; sortie valide à l’expiration. |
| Trou noir | Perturbation locale | Vortex fixe de rayon 3, placé à proximité de l’adversaire le plus proche du collecteur ; actif 6 s. Attraction et ralentissement de 35 % des ennemis, immobilisation de 0,35 s au centre puis libération et 1 s d’immunité. Aucun effet sur les alliés. |
| Raz-de-marée | Retour défensif | Reprend la moitié initiale. Très utile en retard, parfois sans gain si cette moitié est déjà entièrement alliée. Ne conquiert pas gratuitement la moitié ennemie. |
| Vitesse +33 % | Accélération légère | ×1,33 pendant 8 s ; nouvelle collecte renouvelle la durée ; vitesse totale limitée à 32 cases/s. |
| Nitro | Accélération forte | +100 % de vitesse de base par charge pendant 10 s, deux charges indépendantes. Une troisième renouvelle la plus ancienne. Plafond final 32 cases/s. |
| Boule de démolition | Attaque en profondeur | Chaque impact sur une case adverse convertit son voisinage 3 × 3 pendant 8 s. Un mur extérieur ne rapporte pas de territoire. |
| Colosse | Front plus large | Rayon ×2,5 puis ×5 avec deux charges de 8 s. Convertit désormais toute la zone de contact élargie, sans recevoir automatiquement la profondeur 3 × 3 de Démolition. |
| Infiltrateur | Attaque derrière les lignes | Une bille de 10 s arrive en zone adverse avec l’espace nécessaire à son rayon actuel. Chaque nouvelle collecte ajoute 10 s. Respecte le plafond de sept billes. |
| Trinité | Renfort offensif | Deux billes de 12 s par activation, jusqu’à sept billes par camp, infiltrateur compris. Les billes créées ne reçoivent pas un déplacement supplémentaire pendant leur étape de création. |
| Trou de ver | Repositionnement | Déplace uniquement la bille collectrice vers une position alliée éloignée et valide, avec direction conservée. Son intérêt dépend de la géométrie et des bonus accessibles ensuite. |
| Tourelle | Gain progressif | Huit tirs en huit secondes. Chaque projectile convertit la première case adverse rencontrée ; les projectiles déjà tirés terminent leur trajet ou expirent après 4 s. |

Fantôme impose son petit rayon même avec Colosse. Ses traversées n’étant pas des impacts, Démolition ne les élargit pas. Les durées continuent de s’écouler pendant ces combinaisons. Nitro et Vitesse s’appliquent aux renforts ; le plafond de vitesse reste commun. Les copies créées au plafond ne remplacent pas artificiellement les billes existantes.

## Corrections apportées

- **Collecte continue** : le moteur cherche le premier événement sur la trajectoire, entre bonus, cases et murs. Une accélération s’applique dès le contact ; une téléportation abandonne immédiatement l’ancien trajet. L’ordre de stockage des objets n’inverse plus leur ordre de collecte. Les contacts simultanés ont un départage stable.
- **Infiltrateur + Colosse** : la zone d’arrivée est préparée au rayon réel de la bille. Elle n’est plus renvoyée dans son propre camp juste après son apparition.
- **Colosse** : sa taille donne un avantage réel au contact. La zone de contact est son disque agrandi d’une demi-case environ (0,55 case) ; elle suit une façade plus large, alors que Démolition attaque aussi en profondeur.
- **Trou noir** : il ne pénalise plus le camp qui l’a ramassé. Il vise une zone où se trouve un adversaire, sa capture a une durée explicite et la disparition ou le déplacement du vortex libère la bille. L’immunité empêche les captures permanentes.
- **Lisibilité** : anneau du vortex au rayon réel de trois cases, contraste renforcé et anneau autour d’une bille captive. Les collectes et téléportations gardent leurs particules même après une grosse conversion ; le plafond de 300 particules reste respecté.
- Guides français et anglais alignés sur ces règles, y compris priorités, plafonds et limites des combinaisons.

## Mesure de l’impact

96 graines (10 001 à 10 096), avec prélèvement à 15, 60 et 120 secondes si la partie est encore active. Cela fournit **258 situations**, examinées pour les deux camps et les onze bonus : **5 676 branches** par méthode, soit **11 352 branches pour les deux méthodes finales**.

Chaque situation est copiée en témoin et en traitement. Le traitement reçoit un bonus sur sa bille d’origine ; le témoin n’en reçoit pas. Terrain, billes et effets préexistants sont conservés. Le gain ci-dessous est la différence de cases possédées après 15 secondes, pas une probabilité de victoire.

| Bonus | Gain isolé moyen (cases) | Avec les collectes suivantes (cases) |
| --- | ---: | ---: |
| Fantôme | +40,5 | +33,1 |
| Trou noir | +1,3 | −1,1 |
| Raz-de-marée | +28,7 | +24,0 |
| Vitesse +33 % | +2,5 | +5,4 |
| Nitro | +10,3 | +24,4 |
| Démolition | +24,5 | +21,6 |
| Colosse | +9,8 | +15,0 |
| Infiltrateur | +26,2 | +32,2 |
| Trinité | +21,9 | +49,6 |
| Trou de ver | +2,1 | +5,2 |
| Tourelle | +6,6 | +7,5 |

La méthode isolée retire les autres objets au sol et apparitions futures des deux branches. La méthode naturelle conserve ces collectes : Trinité profite notamment de ses billes supplémentaires pour ramasser plus de bonus. Les trajectoires et les tirages suivants peuvent diverger ; cette deuxième mesure est plus variable et n’est pas un classement absolu.

Le Trou noir reste un bonus de contrôle modeste, très dépendant des trajectoires : il ne garantit pas un gain territorial. Son résultat naturel proche de zéro ne prouve ni supériorité ni désavantage systématique. Le Raz-de-marée gagne environ **82 cases** en mesure isolée quand son camp possède moins de 40 % du terrain : sa puissance de retour est intentionnelle. Colosse passe d’environ **+0,6** à **+9,8 cases** en mesure isolée. Les situations naturelles ne sont pas identiques entre les deux versions du moteur ; ce sont des contrôles de cohérence, pas une expérience parfaitement figée entre versions.

Les [données récapitulatives](bonus-audit-1.3.0.json) incluent les moyennes, médianes, dispersions, résultats par camp et par position, configurations, graines et empreintes du moteur. Les détails par branche sont générés par :

```sh
npm run analyze:bonuses -- --seeds 96 --first-seed 10001 --output .local/bonus-isolated.json
npm run analyze:bonuses -- --seeds 96 --first-seed 10001 --follow-up-loot --output .local/bonus-natural.json
```

## Contrôles de fiabilité

Les tests vérifient les effets, renouvellements, charges indépendantes, durée des renforts, capture et libération, huit tirs de tourelle et positions après téléportation. **Les 121 paires ordonnées de bonus** sont exercées sur les deux camps jusqu’à expiration : terrain, vitesses, positions, plafonds d’entités et absence de renforts résiduels sont contrôlés.

Les onze rendus ont été inspectés ; exports français/anglais et stabilité en pause ont été vérifiés sans modification de la simulation. La mesure de **600 parties complètes** donne 301 victoires Crème contre 299 Café, avec une moyenne de **6 min 43 s simulées**, soit **1 min 41 s à ×4**. Voir [les durées détaillées](DUREES.md) et [la validation](VALIDATION.md). Aucun test ne constitue une garantie d’absence absolue de bugs pour toutes les configurations possibles.
