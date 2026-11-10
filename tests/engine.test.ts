import { describe, expect, it } from 'vitest';
import { activateBonus, captureCell, createMatch, stepMatch } from '../src/engine';
import { BASE_RADIUS, BONUS_INFO, DEFAULT_CONFIG, MAX_BALLS, TICK_RATE, normalizeConfig } from '../src/config';
import type { Ball, BonusKind, MatchState, Team } from '../src/types';

// Fixed physics fixtures keep their speed independent of default pacing changes.
const quiet = () => createMatch({ ...DEFAULT_CONFIG, baseSpeed: 8, enabledBonuses: [] }, 12345);
const largeQuiet = () => createMatch({ ...DEFAULT_CONFIG, baseSpeed: 8, columns: 30, rows: 40, winThreshold: 1, enabledBonuses: [] }, 17);
function ball(state: MatchState, team: Team = 'latte'): Ball { return state.balls.find(b => b.team === team)!; }
function aim(b: Ball, x: number, y: number, vx: number, vy: number): void { Object.assign(b, { x, y, vx, vy }); }
function gridWithLatteCount(state: MatchState, count: number): void {
  state.grid.fill(1); state.grid.fill(0, 0, count);
  state.counts = { latte: count, roast: state.grid.length - count }; state.revision++;
}
function simulationSnapshot(state: MatchState) {
  return { tick: state.tick, rng: state.rng, grid: [...state.grid], counts: state.counts, balls: state.balls, effects: state.effects, pickups: state.pickups, vortexes: state.vortexes, turrets: state.turrets, projectiles: state.projectiles, winner: state.winner, history: state.history };
}

describe('terrain et physique', () => {
  it('commence avec 432 cases et deux territoires égaux', () => {
    const state = quiet();
    expect(state.grid).toHaveLength(432);
    expect(state.counts).toEqual({ latte: 216, roast: 216 });
    expect(state.balls.map(b => b.team).sort()).toEqual(['latte', 'roast']);
    expect(state.balls.every(b => b.radius === BASE_RADIUS)).toBe(true);
    for (let y = 0; y < 24; y++) for (let x = 0; x < 18; x++) expect(state.grid[y * 18 + x]).toBe(x < 9 ? 0 : 1);
  });

  it('rebondit sur un mur sans sortir du plateau', () => {
    const state = quiet(); const b = ball(state); state.balls = [b];
    aim(b, 0.42, 6.5, -8, 0); stepMatch(state, 5);
    expect(b.vx).toBeGreaterThan(0);
    expect(b.x).toBeGreaterThanOrEqual(b.radius - 1e-6);
    expect(b.x).toBeLessThan(1);
  });

  it('convertit la case de frontière puis repart dans son territoire', () => {
    const state = quiet(); const b = ball(state); state.balls = [b];
    aim(b, 8.5, 6.5, 8, 0); stepMatch(state, 3);
    expect(state.grid[6 * 18 + 9]).toBe(0);
    expect(state.counts).toEqual({ latte: 217, roast: 215 });
    expect(b.vx).toBeLessThan(0);
  });

  it('détecte un angle de case pendant un déplacement diagonal', () => {
    const state = quiet(); const b = ball(state); state.balls = [b];
    state.config.winThreshold = 1; state.grid.fill(0); state.grid[9 * 18 + 9] = 1;
    state.counts = { latte: 431, roast: 1 }; state.revision++;
    aim(b, 8.2, 8.2, Math.SQRT1_2 * 8, Math.SQRT1_2 * 8); stepMatch(state, 14);
    expect(state.grid[9 * 18 + 9]).toBe(0);
    expect(b.vx).toBeLessThan(0); expect(b.vy).toBeLessThan(0);
  });

  it('ne traverse pas une frontière à la vitesse maximale', () => {
    const state = quiet(); const b = ball(state); state.balls = [b];
    activateBonus(state, 'nitro', 'latte', b.id); activateBonus(state, 'nitro', 'latte', b.id); activateBonus(state, 'speed', 'latte', b.id);
    aim(b, 8.55, 6.5, 32, 0); stepMatch(state, 1);
    expect(state.grid[6 * 18 + 9]).toBe(0);
    expect(b.vx).toBeLessThan(0);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThanOrEqual(32 + 1e-6);
  });

  it('ne compte pas plusieurs fois une case déjà conquise', () => {
    const state = quiet(); captureCell(state, 9, 5, 'latte'); captureCell(state, 9, 5, 'latte');
    expect(state.counts).toEqual({ latte: 217, roast: 215 });
    captureCell(state, 9, 5, 'roast'); expect(state.counts).toEqual({ latte: 216, roast: 216 });
  });

  it('déclare la victoire à 389 cases, jamais à 388', () => {
    const state = quiet(); state.balls = []; gridWithLatteCount(state, 388);
    stepMatch(state, 1); expect(state.winner).toBeNull();
    captureCell(state, 388 % 18, Math.floor(388 / 18), 'latte'); stepMatch(state, 1);
    expect(state.winner).toBe('latte');
    const finalTick = state.tick; stepMatch(state, 120); expect(state.tick).toBe(finalTick);
  });

  it('respecte aussi un seuil personnalisé de 100 %', () => {
    const state = quiet(); state.balls = []; state.config.winThreshold = 1; gridWithLatteCount(state, 431);
    stepMatch(state, 1); expect(state.winner).toBeNull();
    captureCell(state, 17, 23, 'latte'); stepMatch(state, 1); expect(state.winner).toBe('latte');
  });
});

describe('bonus', () => {
  it('fait apparaître le premier bonus au délai configuré', () => {
    const state = createMatch(DEFAULT_CONFIG, 12); state.balls = [];
    stepMatch(state, state.config.spawnSeconds * TICK_RATE - 1); expect(state.pickups).toHaveLength(0);
    stepMatch(state, 1); expect(state.pickups).toHaveLength(1);
    stepMatch(state, TICK_RATE * 60); expect(state.pickups.length).toBeLessThanOrEqual(4);
  });

  it('supprime un bonus non collecté après sa durée de vie', () => {
    const state = quiet(); state.balls = [];
    state.pickups.push({ id: 90, kind: 'speed', x: 2.5, y: 2.5, expiresAt: 15 * TICK_RATE });
    stepMatch(state, 15 * TICK_RATE); expect(state.pickups).toHaveLength(0);
  });

  it('ne distribue un objet qu’une fois lors d’une collecte simultanée', () => {
    const state = quiet(); activateBonus(state, 'ghost', 'latte'); activateBonus(state, 'ghost', 'roast');
    state.balls.forEach(b => aim(b, 4.5, 4.5, 8, 0));
    state.pickups.push({ id: 99, kind: 'nitro', x: 4.5, y: 4.5, expiresAt: 120 });
    stepMatch(state, 1);
    expect(state.pickups).toHaveLength(0); expect(state.effects.filter(e => e.kind === 'nitro')).toHaveLength(1);
  });

  it('le fantôme traverse et peint au lieu de rebondir', () => {
    const state = quiet(); const b = ball(state); state.balls = [b];
    activateBonus(state, 'ghost', 'latte', b.id); aim(b, 8.5, 6.5, 8, 0);
    stepMatch(state, 60);
    expect(b.radius).toBeCloseTo(BASE_RADIUS * 0.4);
    expect(b.x).toBeGreaterThan(11); expect(b.vx).toBeGreaterThan(0);
    expect(state.grid[6 * 18 + 10]).toBe(0);
  });

  it('le raz-de-marée reconquiert uniquement la moitié de départ', () => {
    const state = quiet(); captureCell(state, 2, 3, 'roast'); captureCell(state, 11, 3, 'latte');
    activateBonus(state, 'tidalWave', 'latte');
    for (let y = 0; y < 24; y++) for (let x = 0; x < 9; x++) expect(state.grid[y * 18 + x]).toBe(0);
    expect(state.grid[3 * 18 + 11]).toBe(0); expect(state.grid[3 * 18 + 12]).toBe(1);
  });

  it('la démolition élargit la zone conquise à l’impact', () => {
    const state = quiet(); const b = ball(state); state.balls = [b];
    activateBonus(state, 'wreckingBall', 'latte', b.id); aim(b, 8.5, 6.5, 8, 0); stepMatch(state, 3);
    expect(state.grid[5 * 18 + 10]).toBe(0); expect(state.grid[7 * 18 + 10]).toBe(0);
  });

  it('cumule deux Nitro avec des expirations indépendantes', () => {
    const state = largeQuiet(); const b = ball(state);
    activateBonus(state, 'nitro', 'latte', b.id); expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(16);
    stepMatch(state, 120); activateBonus(state, 'nitro', 'latte', b.id); expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(24);
    stepMatch(state, 9 * TICK_RATE); expect(state.effects.filter(e => e.team === 'latte' && e.kind === 'nitro')).toHaveLength(1);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(16);
    stepMatch(state, TICK_RATE); expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(8);
  });

  it('la priorité Fantôme suspend le rayon Colosse sans supprimer ses charges', () => {
    const state = largeQuiet(); const b = ball(state);
    activateBonus(state, 'colossus', 'latte'); activateBonus(state, 'colossus', 'latte');
    expect(b.radius).toBeCloseTo(BASE_RADIUS * 5);
    activateBonus(state, 'ghost', 'latte'); expect(b.radius).toBeCloseTo(BASE_RADIUS * 0.4);
    stepMatch(state, 6 * TICK_RATE); expect(b.radius).toBeCloseTo(BASE_RADIUS * 5);
    stepMatch(state, 2 * TICK_RATE); expect(b.radius).toBeCloseTo(BASE_RADIUS);
  });

  it.each<BonusKind>(['ghost', 'speed', 'wreckingBall', 'colossus'])('%s expire et restaure les propriétés normales', kind => {
    const state = largeQuiet(); activateBonus(state, kind, 'latte');
    stepMatch(state, BONUS_INFO[kind].seconds * TICK_RATE + 1);
    expect(state.effects.some(e => e.kind === kind)).toBe(false);
    expect(ball(state).radius).toBeCloseTo(BASE_RADIUS);
    expect(Math.hypot(ball(state).vx, ball(state).vy)).toBeCloseTo(8);
  });

  it('Trinité crée deux billes par collecte avec une limite de sept', () => {
    const state = largeQuiet(); activateBonus(state, 'trinity', 'latte');
    expect(state.balls.filter(b => b.team === 'latte')).toHaveLength(3);
    activateBonus(state, 'trinity', 'latte'); expect(state.balls.filter(b => b.team === 'latte')).toHaveLength(5);
    activateBonus(state, 'trinity', 'latte'); activateBonus(state, 'trinity', 'latte');
    expect(state.balls.filter(b => b.team === 'latte')).toHaveLength(MAX_BALLS);
    stepMatch(state, 12 * TICK_RATE); expect(state.balls.filter(b => b.team === 'latte')).toHaveLength(1);
  });

  it('Infiltrateur crée une bille temporaire et prolonge sa mission', () => {
    const state = largeQuiet(); activateBonus(state, 'infiltrator', 'latte');
    const infiltrator = state.balls.find(b => b.role === 'infiltrator')!;
    expect(infiltrator).toBeDefined(); expect(infiltrator.x).toBeGreaterThanOrEqual(state.config.columns / 2);
    const firstEnd = infiltrator.expiresAt!; activateBonus(state, 'infiltrator', 'latte');
    expect(state.balls.filter(b => b.role === 'infiltrator')).toHaveLength(1);
    expect(infiltrator.expiresAt).toBe(firstEnd + 10 * TICK_RATE);
  });

  it('le trou de ver déplace la bille sans changer son élan', () => {
    const state = quiet(); const b = ball(state); aim(b, 2.5, 2.5, 8, 0);
    activateBonus(state, 'wormhole', 'latte', b.id);
    expect(Math.hypot(b.x - 2.5, b.y - 2.5)).toBeGreaterThan(6);
    expect(b.vx).toBeCloseTo(8); expect(b.vy).toBeCloseTo(0);
    expect(state.grid[Math.floor(b.y) * state.config.columns + Math.floor(b.x)]).toBe(0);
  });

  it('le trou noir a une durée bornée et ne laisse pas de vitesse invalide', () => {
    const state = largeQuiet(); activateBonus(state, 'blackHole', 'latte');
    expect(state.vortexes).toHaveLength(1); stepMatch(state, 6 * TICK_RATE);
    expect(state.vortexes).toHaveLength(0);
    expect(state.balls.every(b => Number.isFinite(b.vx) && Number.isFinite(b.vy))).toBe(true);
  });

  it('le fantôme retrouve une position alliée valide lorsqu’il expire derrière la frontière', () => {
    const state = largeQuiet(); const b = ball(state); state.balls = [b];
    activateBonus(state, 'ghost', 'latte', b.id);
    // Isolate the expiration tick from the unrelated six seconds of movement.
    state.tick = 6 * TICK_RATE - 1;
    aim(b, state.config.columns - 0.2, 3.5, 8, 0);
    stepMatch(state, 1);
    expect(b.radius).toBeCloseTo(BASE_RADIUS);
    expect(b.x).toBeGreaterThanOrEqual(b.radius);
    expect(b.x).toBeLessThanOrEqual(state.config.columns - b.radius);
    expect(state.grid[Math.floor(b.y) * state.config.columns + Math.floor(b.x)]).toBe(0);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(8);
  });

  it('deux charges Colosse près d’un coin ne coincent pas la bille dans un mur', () => {
    const state = largeQuiet(); const b = ball(state); state.balls = [b];
    aim(b, 0.4, 0.4, -Math.SQRT1_2 * 8, -Math.SQRT1_2 * 8);
    activateBonus(state, 'colossus', 'latte', b.id);
    activateBonus(state, 'colossus', 'latte', b.id);
    expect(b.x).toBeGreaterThanOrEqual(b.radius);
    expect(b.y).toBeGreaterThanOrEqual(b.radius);
    const start = { x: b.x, y: b.y };
    stepMatch(state, TICK_RATE);
    expect(Math.hypot(b.x - start.x, b.y - start.y)).toBeGreaterThan(0.5);
    expect(b.x).toBeGreaterThanOrEqual(b.radius);
    expect(b.y).toBeGreaterThanOrEqual(b.radius);
    expect(b.x).toBeLessThanOrEqual(state.config.columns - b.radius);
    expect(b.y).toBeLessThanOrEqual(state.config.rows - b.radius);
  });

  it('les changements de territoire sous une bille ne la laissent pas encastrée', () => {
    const state = largeQuiet(); const b = ball(state); state.balls = [b];
    aim(b, 3.5, 3.5, 8, 0);
    captureCell(state, 3, 3, 'roast');
    stepMatch(state, 1);
    expect(Number.isFinite(b.x + b.y + b.vx + b.vy)).toBe(true);
    expect(state.grid[Math.floor(b.y) * state.config.columns + Math.floor(b.x)]).toBe(0);
  });

  it('la tourelle apparaît, tire puis disparaît', () => {
    const state = largeQuiet(); const b = ball(state); aim(b, 2.5, 20.5, 8, 0);
    activateBonus(state, 'turret', 'latte', b.id); expect(state.turrets).toHaveLength(1);
    stepMatch(state, TICK_RATE); expect(state.projectiles.length).toBeGreaterThan(0);
    stepMatch(state, 7 * TICK_RATE); expect(state.turrets).toHaveLength(0);
  });
});

describe('reproductibilité et configuration', () => {
  it('garde le même résultat avec des lots de ticks différents', () => {
    const a = createMatch(DEFAULT_CONFIG, 9876); const b = createMatch(DEFAULT_CONFIG, 9876);
    stepMatch(a, 120 * 30);
    for (let i = 0; i < 120 * 30; i++) stepMatch(b, 1);
    expect(simulationSnapshot(a)).toEqual(simulationSnapshot(b));
  });

  it('rejoue aussi les combinaisons de bonus de façon déterministe', () => {
    const a = largeQuiet(); const b = largeQuiet();
    for (const s of [a, b]) { activateBonus(s, 'nitro', 'latte'); activateBonus(s, 'colossus', 'latte'); activateBonus(s, 'trinity', 'roast'); activateBonus(s, 'ghost', 'roast'); }
    stepMatch(a, 1800); for (let i = 0; i < 450; i++) stepMatch(b, 4);
    expect(simulationSnapshot(a)).toEqual(simulationSnapshot(b));
  });

  it('borne les réglages et supprime les doublons de bonus', () => {
    const c = normalizeConfig({ columns: 99, rows: -4, baseSpeed: Infinity, winThreshold: 3, spawnSeconds: 0, enabledBonuses: ['nitro', 'nitro'] });
    expect(c).toEqual({ columns: 30, rows: 16, baseSpeed: DEFAULT_CONFIG.baseSpeed, winThreshold: 1, spawnSeconds: 1, enabledBonuses: ['nitro'] });
  });

  it('protège la configuration de référence des modifications d’une partie', () => {
    const state = createMatch(DEFAULT_CONFIG, 8); state.config.enabledBonuses.length = 0;
    expect(DEFAULT_CONFIG.enabledBonuses).toHaveLength(11);
  });
});
