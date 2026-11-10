import type { BonusKind, MatchConfig, Preferences } from './types';
export const RULES_VERSION = '1.1.0';
export const TICK_RATE = 120;
export const BASE_RADIUS = 0.37;
export const MAX_BALLS = 7;
export const BONUS_KINDS: BonusKind[] = ['ghost', 'blackHole', 'tidalWave', 'speed', 'nitro', 'wreckingBall', 'colossus', 'infiltrator', 'trinity', 'wormhole', 'turret'];
export const BONUS_INFO: Record<BonusKind, { name: string; icon: string; description: string; seconds: number }> = {
  ghost: { name: 'Fantôme d’éclipse', icon: '◌', description: 'De minuscules billes traversent les frontières et peignent leur passage pendant 6 secondes.', seconds: 6 },
  blackHole: { name: 'Trou noir', icon: '◎', description: 'Un vortex fixe de 3 cases de rayon apparaît près d’un adversaire pendant 6 secondes. Il attire et ralentit les ennemis de 35 %, les retient 0,35 s au centre puis les libère avec 1 s d’immunité. Les alliés sont épargnés.', seconds: 6 },
  tidalWave: { name: 'Raz-de-marée', icon: '≋', description: 'Votre moitié de départ reprend instantanément vos couleurs.', seconds: 1 },
  speed: { name: 'Vitesse +33 %', icon: '↗', description: 'Vos billes gagnent 33 % de vitesse pendant 8 secondes, dans la limite de 32 cases/s. Une nouvelle collecte renouvelle la durée.', seconds: 8 },
  nitro: { name: 'Nitro', icon: 'ϟ', description: 'Chaque charge ajoute la vitesse de base et une traînée lumineuse pendant 10 secondes. Deux charges indépendantes, vitesse totale limitée à 32 cases/s.', seconds: 10 },
  wreckingBall: { name: 'Boule de démolition', icon: '✦', description: 'Chaque impact sur une case adverse conquiert une zone de 3 × 3 pendant 8 secondes. Le Fantôme traverse sans impact : cet effet attend son expiration, mais sa durée continue.', seconds: 8 },
  colossus: { name: 'Colosse', icon: '●', description: 'Pendant 8 secondes, le rayon passe à ×2,5, puis ×5 avec deux charges. La bille conquiert un front plus large au contact. Le Fantôme impose temporairement son petit rayon.', seconds: 8 },
  infiltrator: { name: 'Infiltrateur', icon: '◇', description: 'Une bille s’installe derrière les lignes adverses pour 10 secondes, même avec Colosse. Chaque collecte suivante ajoute 10 secondes. Limite totale : sept billes par camp.', seconds: 10 },
  trinity: { name: 'Trinité', icon: '⁙', description: 'Deux billes supplémentaires pendant 12 secondes, dans la limite de sept par camp.', seconds: 12 },
  wormhole: { name: 'Trou de ver', icon: '⟷', description: 'La bille réapparaît à un endroit éloigné de son territoire, sans perdre son élan.', seconds: 1 },
  turret: { name: 'Tourelle', icon: '⊕', description: 'Pendant 8 secondes, une tourelle tire chaque seconde vers le territoire adverse.', seconds: 8 }
};
export const DEFAULT_CONFIG: MatchConfig = { columns: 18, rows: 24, baseSpeed: 11, winThreshold: 0.9, spawnSeconds: 2, enabledBonuses: [...BONUS_KINDS] };
export function normalizeConfig(value: Partial<MatchConfig> = {}): MatchConfig {
  const number = (n: unknown, fallback: number, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  const columns = Math.round(number(value.columns, DEFAULT_CONFIG.columns, 12, 30) / 2) * 2;
  return { columns, rows: Math.round(number(value.rows, DEFAULT_CONFIG.rows, 16, 40)), baseSpeed: number(value.baseSpeed, DEFAULT_CONFIG.baseSpeed, 4, 12), winThreshold: number(value.winThreshold, DEFAULT_CONFIG.winThreshold, 0.7, 1), spawnSeconds: number(value.spawnSeconds, DEFAULT_CONFIG.spawnSeconds, 1, 10), enabledBonuses: Array.isArray(value.enabledBonuses) ? BONUS_KINDS.filter(k => value.enabledBonuses!.includes(k)) : [...BONUS_KINDS] };
}
export const defaultPreferences = (): Preferences => ({ language: 'en', theme: 'coffee', sound: true, volume: 0.3, reducedEffects: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, profile: 'faithful', customConfig: normalizeConfig() });
export function formatTime(ticks: number): string { const s = Math.floor(ticks / TICK_RATE); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
export const teamName = (team: 'latte' | 'roast') => team === 'latte' ? 'Crème' : 'Café';
