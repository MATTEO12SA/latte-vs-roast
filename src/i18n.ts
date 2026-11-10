import { BONUS_INFO } from './config';
import type { BonusKind, Language, Team } from './types';

/** Original French copy is the stable key; simulation identifiers never change. */
export const ENGLISH: Record<string, string> = {
  'Latte vs Roast — le duel infusé': 'Latte vs Roast — a freshly brewed duel',
  'Crème contre Café. Deux billes, onze pouvoirs, un territoire à conquérir. Une simulation à regarder, personnaliser et partager.': 'Latte versus Roast. Two balls, eleven powers, one territory to conquer. A simulation to watch, customize and share.',
  'Latte vs Roast, accueil': 'Latte vs Roast, home',
  'LE DUEL INFUSÉ': 'A FRESHLY BREWED DUEL',
  'UNE EXPÉRIENCE AUTONOME': 'AN AUTONOMOUS EXPERIENCE',
  'Voir le code sur GitHub': 'View the code on GitHub',
  'Langue': 'Language',
  'Simulation de conquête de territoire': 'Territory conquest simulation',
  'La bataille infuse': 'The battle is brewing',
  'La bataille se repose': 'The battle is resting',
  'La bataille est terminée': 'The battle is over',
  'FIDÈLE': 'ORIGINAL',
  'SUR MESURE': 'CUSTOM',
  'Bonus actifs': 'Active power-ups',
  'Deux nuances. Un seul territoire.': 'Two shades. One territory.',
  'Terrain de la bataille, Crème à gauche et Café à droite': 'Battlefield, Latte on the left and Roast on the right',
  'Le jeu nécessite un navigateur compatible avec Canvas 2D.': 'This game requires a browser that supports Canvas 2D.',
  'On laisse reposer.': 'Let it rest.',
  'Reprendre la partie': 'Resume the match',
  'FIN DE L’INFUSION': 'BREWING COMPLETE',
  'Café domine !': 'Roast dominates!',
  'Une nouvelle bataille': 'A new battle',
  'Rejouer cette partie': 'Replay this match',
  'Répartition du territoire': 'Territory ownership',
  'Crème': 'Latte', 'Café': 'Roast',
  'Commandes de la partie': 'Match controls',
  'Mettre en pause': 'Pause the match',
  'Pause': 'Pause', 'Reprendre': 'Resume',
  'Vitesse de lecture': 'Playback speed',
  '×0,5': '×0.5',
  'Rejouer la même partie': 'Replay the same match',
  'Nouvelle partie': 'New match',
  'Activer le son': 'Enable sound',
  'Le navigateur bloque encore le son. Touchez à nouveau le bouton du son.': 'The browser is still blocking audio. Tap the sound button again.',
  'Ce navigateur ne prend pas en charge le son du jeu.': 'This browser does not support game audio.',
  'Couper le son': 'Mute sound',
  'Plein écran': 'Full screen',
  'Identifiant reproductible de la partie': 'Reproducible match identifier',
  'GRAINE —': 'SEED —', 'GRAINE': 'SEED', 'Graine': 'Seed',
  'Partager': 'Share', 'Capture': 'Capture',
  'Explorer et personnaliser le jeu': 'Explore and customize the game',
  'Réglages': 'Settings', 'Les bonus': 'Power-ups', 'Statistiques': 'Statistics',
  'À VOTRE GOÛT': 'TO YOUR TASTE',
  'La recette de la partie': 'Your match recipe',
  'Les règles s’appliquent à la prochaine bataille. Le style et le son changent tout de suite.': 'Rules apply to your next battle. Style and sound change immediately.',
  'Mode de jeu': 'Game mode', 'Fidèle': 'Original', 'Sur mesure': 'Custom',
  'La recette d’origine · 18 × 24': 'The original recipe · 18 × 24',
  'Personnalisé': 'Custom', 'Votre terrain, vos règles': 'Your board, your rules',
  'Paramètres personnalisés': 'Custom settings',
  'Colonnes': 'Columns', 'Lignes': 'Rows', 'Vitesse des billes': 'Ball speed',
  'cases/s': 'cells/s', 'Territoire pour gagner': 'Territory to win',
  'Un bonus toutes les': 'A power-up every', 'secondes': 'seconds',
  'Bonus disponibles': 'Available power-ups', 'Ambiance': 'Theme',
  'Café d’origine': 'Original coffee', 'Après minuit': 'After midnight',
  'Contraste renforcé': 'High contrast', 'Volume': 'Volume',
  'Réduire les effets visuels': 'Reduce visual effects',
  'Moins de particules et de traînées.': 'Fewer particles and trails.',
  'Lancer avec ces réglages': 'Start with these settings',
  'Réinitialiser les préférences': 'Reset preferences',
  'LES PETITS IMPRÉVUS': 'A FEW LITTLE SURPRISES',
  'Onze façons de tout renverser.': 'Eleven ways to turn the tide.',
  'Les billes récupèrent les carrés corail. Chaque pouvoir profite à leur camp et peut changer le cours de la bataille.': 'Balls collect the coral squares. Each power helps their team and can change the course of the battle.',
  'Une reconstruction d’après vidéo. Les effets peu visibles ont des règles documentées dans le dépôt.': 'Recreated from a gameplay video. Reconstructed rules for less-visible effects are documented in the repository.',
  'LE CARNET DES BATAILLES': 'THE BATTLE JOURNAL',
  'Chaque partie laisse une trace.': 'Every match leaves a mark.',
  'Vos résultats restent dans ce navigateur, sans compte.': 'Your results stay in this browser. No account needed.',
  'Évolution du dernier duel terminé': 'Your latest completed duel',
  'Part du territoire Crème': 'Latte territory share',
  'Courbe du territoire Crème de la dernière partie': 'Latte territory chart for the latest match',
  'Deux billes qui rebondissent. Des frontières qui changent.': 'Two bouncing balls. Ever-changing borders.',
  'Le premier camp à': 'The first team to reach',
  'remporte le duel.': 'wins the duel.',
  'Fait pour regarder le temps passer.': 'Made for watching time go by.',
  'Fermer': 'Close', 'UNE PARTIE À TRANSMETTRE': 'A MATCH TO PASS ON',
  'Le même duel, ailleurs.': 'The same duel, somewhere else.',
  'Ce lien relance la partie depuis le début avec les mêmes règles et la même graine.': 'This link replays the match from the start with the same rules and seed.',
  'Lien de la partie': 'Match link', 'Copier le lien': 'Copy link',
  'Le stockage est indisponible. Vos réglages restent actifs pour cette visite.': 'Storage is unavailable. Your settings remain active for this visit.',
  'Partie terminée. L’historique n’a pas pu être enregistré dans ce navigateur.': 'Match finished. Its result could not be saved in this browser.',
  'domine !': 'dominates!', 'DOMINE !': 'DOMINATES!', 'de bataille': 'of battle',
  'du territoire': 'of the territory',
  'victoires Crème': 'Latte wins', 'victoires Café': 'Roast wins',
  'durée moyenne': 'average duration',
  'La courbe apparaîtra après votre premier duel.': 'The chart will appear after your first duel.',
  'Le carnet est encore vierge. Laissez une partie se terminer pour découvrir ses résultats.': 'Your journal is still empty. Let a match finish to see its results.',
  'remporte le duel': 'wins the duel', 'Rejouer ↗': 'Replay ↗',
  'Rejouer la partie': 'Replay match',
  'Une nouvelle bataille, à votre goût.': 'A new battle, brewed your way.',
  'Préférences réinitialisées. La partie en cours est conservée.': 'Preferences reset. Your current match is unchanged.',
  'Lien copié. La bataille peut voyager.': 'Link copied. Let the battle travel.',
  'Sélectionnez et copiez le lien ci-dessus.': 'Select and copy the link above.',
  'La capture n’a pas pu être créée.': 'The capture could not be created.',
  'Votre capture est prête.': 'Your capture is ready.',
  'Partie partagée chargée. Même graine, mêmes règles.': 'Shared match loaded. Same seed, same rules.',
  'Le stockage local est indisponible ; vous pouvez tout de même jouer.': 'Local storage is unavailable, but you can still play.',
  'Cette partie utilise une autre version des règles et ne peut pas être rejouée ici.': 'This match uses a different rules version and cannot be replayed here.',
  'Ce lien de partie est incomplet ou invalide. Vous pouvez démarrer une nouvelle bataille.': 'This match link is incomplete or invalid. You can start a new battle.',
  'Victoire en': 'Victory in', 'Règles': 'Rules',
  'CRÈME CONTRE CAFÉ': 'LATTE VERSUS ROAST',
  'Crème contre Café': 'Latte versus Roast',
  'Duel de territoires': 'Territory duel',
  'Durée': 'Duration',
  'UNE BATAILLE. DEUX CARACTÈRES.': 'ONE BATTLE. TWO CHARACTERS.',
  'Partie': 'Match',
  'Anciennes règles': 'Older rules',
  'Le duel en cours': 'The current duel',
  'Progression en direct': 'Live progress',
  'Parties terminées': 'Completed matches',
  'Les victoires et la durée moyenne comptent uniquement les parties terminées. La progression du duel en cours apparaît ci-dessous.': 'Wins and average duration count completed matches only. Follow the current duel below.',
  'Durée en cours': 'Elapsed time',
  'Billes en jeu': 'Balls in play',
  'Courbe du territoire Crème de la partie en cours': 'Latte territory chart for the current match',
  'Partie en pause': 'Match paused',
  'Partie terminée': 'Match finished',
  'En direct': 'Live'
};

const bonusEnglish: Record<BonusKind, { name: string; description: string }> = {
  ghost: { name: 'Eclipse Ghost', description: 'Tiny balls cross borders and paint their path for 6 seconds.' },
  blackHole: { name: 'Black Hole', description: 'A fixed vortex with a 3-cell radius appears near an opponent for 6 seconds. It pulls enemies in and slows them by 35%, holds them for 0.35 s at the center, then releases them with 1 s of immunity. Allies are unaffected.' },
  tidalWave: { name: 'Tidal Wave', description: 'Your starting half instantly returns to your team’s color.' },
  speed: { name: 'Speed +33%', description: 'Your balls gain 33% speed for 8 seconds, capped at 32 cells/s. Another pickup refreshes the duration.' },
  nitro: { name: 'Nitro', description: 'Each charge adds base speed and a glowing trail for 10 seconds. Two independent charges, with total speed capped at 32 cells/s.' },
  wreckingBall: { name: 'Wrecking Ball', description: 'Each impact on an enemy cell captures a 3 × 3 area for 8 seconds. Ghost crosses without impacts: this effect waits for Ghost to end, but its timer keeps running.' },
  colossus: { name: 'Colossus', description: 'For 8 seconds, radius grows ×2.5, or ×5 with two charges. The ball captures a wider front on impact. Ghost temporarily overrides it with its tiny radius.' },
  infiltrator: { name: 'Infiltrator', description: 'A ball lands behind enemy lines for 10 seconds, even with Colossus. Each further pickup adds 10 seconds. Total limit: seven balls per team.' },
  trinity: { name: 'Trinity', description: 'Two extra balls for 12 seconds, up to seven balls per team.' },
  wormhole: { name: 'Wormhole', description: 'The ball reappears in a distant part of its territory, keeping its momentum.' },
  turret: { name: 'Turret', description: 'For 8 seconds, a turret fires at enemy territory every second.' }
};

export const t = (french: string, language: Language): string => language === 'en' ? ENGLISH[french] ?? french : french;
export const localeFor = (language: Language): string => language === 'en' ? 'en-GB' : 'fr-FR';
export const localizedTeamName = (team: Team, language: Language): string => team === 'latte' ? t('Crème', language) : t('Café', language);
export const bonusInfo = (kind: BonusKind, language: Language) => ({ ...BONUS_INFO[kind], ...(language === 'en' ? bonusEnglish[kind] : {}) });

// Keep text nodes and controls intact when changing locale, including form drafts.
const originalText = new WeakMap<Node, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const reverse = new Map(Object.entries(ENGLISH).map(([fr, en]) => [en, fr]));
export function applyStaticTranslations(language: Language): void {
  document.documentElement.lang = language;
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('script, style')) continue;
    const current = node.textContent ?? '';
    const trimmed = current.trim();
    let original = originalText.get(node);
    if (!original) {
      const french = Object.hasOwn(ENGLISH, trimmed) ? trimmed : reverse.get(trimmed);
      if (!french) continue;
      original = french; originalText.set(node, original);
    }
    node.textContent = current.replace(trimmed, t(original, language));
  }
  for (const element of document.querySelectorAll('[aria-label], [title], meta[name="description"]')) {
    const attributes = originalAttributes.get(element) ?? new Map<string, string>();
    for (const attribute of ['aria-label', 'title', 'content']) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const original = attributes.get(attribute) ?? (Object.hasOwn(ENGLISH, value) ? value : reverse.get(value));
      if (!original) continue;
      attributes.set(attribute, original); element.setAttribute(attribute, t(original, language));
    }
    originalAttributes.set(element, attributes);
  }
}
