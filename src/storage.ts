import { BONUS_KINDS, defaultPreferences, normalizeConfig, RULES_VERSION } from './config';
import type { MatchConfig, MatchRecord, MatchState, Preferences, ThemeName } from './types';
const PREFS_KEY = 'latte-vs-roast.preferences.v1';
const HISTORY_KEY = 'latte-vs-roast.history.v1';
let available = true;
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function read(key: string): unknown { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { available = false; return null; } }
function write(key: string, data: unknown): boolean { try { localStorage.setItem(key, JSON.stringify(data)); available = true; return true; } catch { available = false; return false; } }
export const storageAvailable = () => available;
export function loadPreferences(): Preferences {
  const defaults = defaultPreferences(), v = read(PREFS_KEY);
  if (!object(v)) return defaults;
  return { theme: ['coffee', 'night', 'contrast'].includes(String(v.theme)) ? v.theme as ThemeName : defaults.theme, sound: v.sound === true, volume: typeof v.volume === 'number' && Number.isFinite(v.volume) ? Math.max(0, Math.min(1, v.volume)) : defaults.volume, reducedEffects: typeof v.reducedEffects === 'boolean' ? v.reducedEffects : defaults.reducedEffects, profile: v.profile === 'custom' ? 'custom' : 'faithful', customConfig: normalizeConfig(object(v.customConfig) ? v.customConfig : {}) };
}
export const savePreferences = (preferences: Preferences) => write(PREFS_KEY, preferences);
export function loadRecords(): MatchRecord[] {
  const data = read(HISTORY_KEY);
  if (!Array.isArray(data)) return [];
  return data.slice(0, 100).filter((v): v is MatchRecord => object(v) && typeof v.id === 'string' && typeof v.date === 'string' && !Number.isNaN(Date.parse(v.date)) && v.version === RULES_VERSION && Number.isInteger(v.seed) && typeof v.ticks === 'number' && Number.isFinite(v.ticks) && v.ticks >= 0 && (v.winner === 'latte' || v.winner === 'roast') && object(v.config) && Array.isArray(v.history)).map(v => ({ ...v, config: normalizeConfig(v.config), history: v.history.filter(p => object(p) && typeof p.tick === 'number' && Number.isFinite(p.tick) && p.tick >= 0 && typeof p.latte === 'number' && Number.isFinite(p.latte) && p.latte >= 0 && p.latte <= 1).slice(-1800) }));
}
// Seule la dernière courbe est affichée : les anciens duels restent rejouables
// avec leur graine, sans conserver cent séries de milliers de mesures.
export const saveRecords = (records: MatchRecord[]) => write(HISTORY_KEY, records.slice(0, 100).map((record, index) => ({ ...record, history: index === 0 ? record.history.slice(-1800) : [] })));
export function recordMatch(state: MatchState, id: string): MatchRecord {
  if (!state.winner) throw new Error('Cette partie n’est pas terminée.');
  return { id, date: new Date().toISOString(), seed: state.seed, config: structuredClone(state.config), version: RULES_VERSION, winner: state.winner, ticks: state.tick, history: state.history.map(p => ({ ...p })) };
}
export function makeShareURL(state: Pick<MatchState, 'seed' | 'config'>): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = `partie=${btoa(JSON.stringify({ v: RULES_VERSION, s: state.seed, c: state.config })).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`;
  return url.href;
}
export function parseShare(hash: string): { seed: number; config: MatchConfig } | { error: string } | null {
  if (!hash || hash === '#') return null;
  if (!hash.startsWith('#partie=')) return null;
  try {
    if (hash.length > 5000) throw new Error();
    const data: unknown = JSON.parse(atob(hash.slice(8).replaceAll('-', '+').replaceAll('_', '/')));
    if (!object(data)) throw new Error();
    if (data.v !== RULES_VERSION) return { error: 'Cette partie utilise une autre version des règles et ne peut pas être rejouée ici.' };
    if (typeof data.s !== 'number' || !Number.isInteger(data.s) || data.s < 0 || data.s > 4294967295 || !object(data.c)) throw new Error();
    const c = data.c;
    if (!Array.isArray(c.enabledBonuses) || c.enabledBonuses.length > 11 || c.enabledBonuses.some(k => !BONUS_KINDS.includes(k)) || new Set(c.enabledBonuses).size !== c.enabledBonuses.length) throw new Error();
    const config = normalizeConfig(c);
    for (const key of ['columns', 'rows', 'baseSpeed', 'winThreshold', 'spawnSeconds'] as const) if (c[key] !== config[key]) throw new Error();
    return { seed: data.s, config };
  } catch { return { error: 'Ce lien de partie est incomplet ou invalide. Vous pouvez démarrer une nouvelle bataille.' }; }
}
