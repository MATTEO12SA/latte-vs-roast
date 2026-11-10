# Historique des versions

## 1.3.0 — Bonus cohérents et son mobile

- Audit des onze bonus, 121 paires de combinaisons, mesures isolées et avec collectes suivantes ; rapports, données et commande `analyze:bonuses`.
- Colosse conquiert un front plus large. Trou noir vise un adversaire, ralentit les ennemis et les retient brièvement, avec libération et immunité ; les alliés sont épargnés.
- Infiltrateur conserve son arrivée en territoire ennemi avec Colosse. Les bonus sont collectés au premier contact réel et les effets s’appliquent immédiatement au reste du mouvement.
- Vortex lisible à son vrai rayon, indication des captures et priorité aux particules de collecte sous forte charge.
- Audio créé au toucher, premier appui sonore qui active au lieu de couper, reprise après interruption et sons de rebond plus audibles sur petit haut-parleur. Aucun bouton ni son de test.
- Guides français et anglais actualisés, historique des anciennes règles conservé. Les règles passent à **1.1.0** : les anciens liens ne sont pas rejoués silencieusement.
- 77 tests de logique, 54 scénarios navigateur ; 600 parties terminées, 301 victoires Crème / 299 Café, moyenne **6 min 43 s** simulées (**1 min 41 s à ×4**).

## 1.2.0 — English / Français et son activé

- Anglais par défaut et sélecteur English / Français en haut à droite, utilisable sur mobile.
- Traduction des menus, bonus, résultats, statistiques, messages et captures PNG ; choix mémorisé sans relancer la partie ni effacer les réglages en cours de saisie.
- Son activé par défaut, débloqué au premier geste lorsque le navigateur l’exige ; bouton de coupure et choix mémorisé.
- Migration des préférences antérieures et nouvelles vérifications de langue, son et présentation mobile.
- Statistiques de la partie en cours : durée, parts de territoire, nombre de billes et courbe en direct, y compris avant la première victoire.
- Correction d’une résurrection du camp éliminé au seuil de 100 %, et d’une collecte de bonus sur un trajet abandonné après téléportation.
- Règles 1.0.1 : les anciens résultats restent dans le carnet, mais leurs anciens liens ne sont pas rejoués avec des règles différentes.
- Rythme par défaut ajusté à 11 cases/s et un bonus toutes les 2 secondes après mesure : moyenne de 8 min 21 s sur 600 parties, soit 2 min 05 s à ×4. Les liens 1.0.1 contenant les anciens paramètres restent reproductibles.
- Commande `npm run simulate`, rapport des durées et données par graine publiés pour vérifier les moyennes et les parties longues.

## 1.1.0 — Version enrichie

- Profil Personnalisé : dimensions, vitesse, seuil de victoire, fréquence et sélection des bonus.
- Thèmes café, nuit et contraste renforcé.
- Préférences et historique local des 100 dernières parties, compteurs et courbe de territoire.
- Partage d’une partie par graine et configuration versionnée ; export d’une capture PNG.
- Conservation des règles de simulation **1.0.0** pour le profil Fidèle.

## Socle 1.0.0 — Reconstruction complète, intégré à la version 1.1.0

- Duel autonome Crème contre Café sur un terrain de 18 × 24 cases.
- Collisions, conversion de cases, jauges de territoire et victoire à 90 %.
- Onze bonus, cumuls, expirations, renforts et effets visuels.
- Interface française adaptée à l’ordinateur et au mobile.
- Pause, nouvelle partie, rejeu, vitesses de lecture, plein écran et sons activables.
- Moteur à pas fixe et graine aléatoire, tests de règles et 200 graines de robustesse.
- Publication statique sur GitHub Pages après vérifications automatisées.

La première livraison publique rassemble le socle et les améliorations sous la version 1.1.0. La version des règles reste 1.0.0. Les dates et références de publication sont portées par les tags et releases GitHub.
