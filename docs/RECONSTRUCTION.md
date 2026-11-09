# Règles et choix de reconstruction

Version des règles : **1.0.0**. Cette version identifie le comportement de simulation utilisé par les liens de partage ; elle est indépendante de la version de l’application.

## Ce que montre la vidéo

La référence est une vidéo verticale de 720 × 1280 pixels, d’environ 93 secondes. Elle montre un plateau de 18 × 24 cases, initialement partagé en deux moitiés. Une bille noire se déplace dans la zone crème et une bille dorée dans la zone marron. Les collisions convertissent les cases adverses. Les bonus sont représentés par des carrés corail ; les effets actifs apparaissent dans des bandeaux au-dessus du terrain.

Les deux jauges en dessous du terrain indiquent les territoires. La victoire de Roast est affichée à 1 minute 28 secondes alors que des cases adverses subsistent. Le seuil de 90 % est donc un choix cohérent avec la référence, sans être une valeur démontrable au pixel près.

Les intitulés de onze bonus sont lisibles. Les collectes multiples de Nitro, Colosse et Trinité sont visibles. Aucune commande directe des billes n’apparaît ; la reconstruction utilise une simulation autonome.

## Paramètres de référence

| Paramètre | Valeur |
| --- | --- |
| Terrain | 18 × 24 cases |
| Partage initial | Moitié gauche Crème, moitié droite Café |
| Billes initiales | Une par camp |
| Rayon normal | 0,37 case |
| Vitesse normale | 8 cases/s |
| Physique | 120 étapes fixes par seconde |
| Victoire | 90 %, soit au moins 389 cases |
| Premier bonus | Après 3 secondes simulées |
| Bonus suivants | Toutes les 3 secondes simulées |
| Sélection | Uniforme parmi les types activés |
| Objets au sol | Quatre maximum, durée de vie de 15 s |
| Billes | Sept maximum par camp, infiltrateur compris |
| Vitesse maximale | 32 cases/s |

Les billes n’ont pas de collision entre elles. Une conversion de case conserve toujours un unique propriétaire ; la somme des territoires reste égale au nombre de cases du plateau.

## Bonus : observation et choix

| Bonus français / nom de référence | Ce qui est observé | Règle retenue |
| --- | --- | --- |
| Fantôme d’éclipse / Eclipse Ghost | Petite bille traversant le territoire adverse en y traçant un chemin | Rayon ×0,4 et conversion au passage sans rebond pendant 6 s |
| Trou noir / Black Hole | Vortex fixe, particules et bille retenue à proximité | Attraction dans un rayon de 3 cases pendant 6 s, capture courte et relâchement borné |
| Raz-de-marée / Tidal Wave | Disparition d’une grande avancée adverse | Reconquête instantanée de la moitié de départ du camp bénéficiaire |
| Vitesse +33 % / Speed +33% | Intitulé lisible | Vitesse ×1,33 pendant 8 s ; collecte suivante renouvelle la durée |
| Nitro / Nitro | Longue traînée lumineuse, déplacement rapide, cumul visible | +100 % de vitesse de base par charge pendant 10 s, deux charges indépendantes maximum |
| Boule de démolition / Wrecking Ball | Intitulé et fragments d’impact | Conversion d’une zone de 3 × 3 cases autour de l’impact pendant 8 s |
| Colosse / Colossus | Très grande bille et deux activations simultanées | Rayon ×2,5 avec une charge, ×5 avec deux, 8 s par charge |
| Infiltrateur / Infiltrator +10 seconds | Intitulé et apparition d’une bille supplémentaire | Une bille temporaire en territoire adverse, 10 s, prolongation de 10 s aux collectes suivantes |
| Trinité / Trinity | Multiplication des billes, deux activations et environ cinq billes | Deux billes supplémentaires par collecte pendant 12 s |
| Trou de ver / Wormhole | Intitulé ; trajet exact difficile à isoler | Téléportation vers une position alliée éloignée en conservant l’élan |
| Tourelle / Turret | Élément circulaire fixe et intitulé | Installation de 8 s ; un projectile par seconde vers les cases adverses |

Les durées, rayons et formules ci-dessus sont des **paramètres de reconstruction**, pas des valeurs extraites du code original. En particulier, Trou noir, Boule de démolition, Infiltrateur, Trou de ver et Tourelle ne sont pas entièrement déductibles des images.

## Cumuls et situations limites

- Chaque camp reçoit les effets temporaires sur l’ensemble de ses billes. Les projectiles de tourelle ne deviennent pas des billes bénéficiant des mêmes bonus.
- Nitro et Colosse possèdent au plus deux charges. Les charges expirent séparément ; vitesse et rayon sont recalculés depuis les propriétés normales.
- Le Fantôme impose son petit rayon pendant sa durée. Les charges Colosse continuent d’expirer pendant ce temps.
- Les bonus de renfort respectent le plafond de sept billes. Une collecte ne détruit pas une bille existante pour en créer une autre.
- Le même objet au sol ne peut être attribué qu’à un seul camp. L’ordre de traitement est stable pour conserver le rejeu déterministe.
- Les apparitions, téléportations et changements de rayon maintiennent les billes à l’intérieur du terrain et recherchent une position exploitable.
- La victoire est vérifiée après une étape complète de simulation. La partie terminée ne continue pas à modifier le terrain.
- Une pause arrête le temps de simulation, donc les durées des effets et des renforts.

## Fidélité et améliorations

Le profil Fidèle verrouille la configuration ci-dessus. Les traductions françaises et les commandes autour du terrain sont des adaptations explicites. Les thèmes, les sons générés et les effets réduits modifient la présentation, pas les tirages ou les règles.

Le profil Personnalisé peut modifier la taille, la vitesse, le seuil de victoire, la fréquence et la liste des bonus. Ces paramètres font partie des liens partagés. Les statistiques restent locales à l’appareil.

Une partie tirée au hasard n’a pas vocation à reproduire la suite exacte des événements de la vidéo. Les points de comparaison sont le départ, la géométrie des captures, les signes visuels des bonus, la présentation des jauges et l’écran de victoire.

## Validation et limites connues

Les tests automatisés sont décrits dans le README. Les captures de navigateur servent à contrôler le placement et les proportions. La simulation d’un téléphone dans Playwright ne valide pas le comportement thermique, la batterie, le tactile physique ni les performances d’un téléphone réel. Ces points restent un contrôle manuel sur matériel, sans bloquer la disponibilité du jeu web.

Les sons sont générés pour ce projet ; ils ne prétendent pas reproduire la bande sonore du fichier fourni. Aucun asset ni extrait de la vidéo de référence n’est publié dans le dépôt.
