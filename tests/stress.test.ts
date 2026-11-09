import { expect, it } from 'vitest';
import { activateBonus, createMatch, stepMatch } from '../src/engine';
import { DEFAULT_CONFIG, MAX_BALLS, TICK_RATE } from '../src/config';
import type { MatchState } from '../src/types';

function assertInvariant(state: MatchState, label: string): void {
  const latte = state.grid.reduce((sum, cell) => sum + (cell === 0 ? 1 : 0), 0);
  if (state.grid.some(cell => cell !== 0 && cell !== 1)) throw new Error(`${label}: case sans propriétaire`);
  if (state.counts.latte !== latte || state.counts.roast !== state.grid.length - latte) throw new Error(`${label}: décompte incohérent`);
  if (state.pickups.length > 4 || state.balls.filter(b => b.team === 'latte').length > MAX_BALLS || state.balls.filter(b => b.team === 'roast').length > MAX_BALLS) throw new Error(`${label}: plafond d’entités dépassé`);
  for (const b of state.balls) {
    if (![b.x, b.y, b.vx, b.vy, b.radius].every(Number.isFinite)) throw new Error(`${label}: bille invalide`);
    if (b.radius <= 0 || b.x < b.radius - 1e-5 || b.y < b.radius - 1e-5 || b.x > state.config.columns - b.radius + 1e-5 || b.y > state.config.rows - b.radius + 1e-5) throw new Error(`${label}: bille hors terrain`);
    if (Math.hypot(b.vx, b.vy) > 32 + 1e-5) throw new Error(`${label}: vitesse non bornée`);
  }
}

it('200 graines restent cohérentes pendant 120 secondes ou jusqu’à la victoire', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const state = createMatch(DEFAULT_CONFIG, seed);
    for (let second = 0; second < 120 && !state.winner; second++) {
      stepMatch(state, TICK_RATE);
      assertInvariant(state, `graine ${seed}, seconde ${second + 1}`);
    }
    expect(state.tick).toBeGreaterThan(0);
  }
}, 120000);

it('une partie libre complète atteint réellement le seuil de victoire', () => {
  // Le profil fidèle n'a pas de durée limite : la vidéo ne constitue pas une
  // garantie que chaque tirage aléatoire se termine en moins de deux minutes.
  const state = createMatch(DEFAULT_CONFIG, 1);
  for (let second = 0; second < 600 && !state.winner; second++) {
    stepMatch(state, TICK_RATE);
    assertInvariant(state, `partie complète, seconde ${second + 1}`);
  }
  expect(state.winner).not.toBeNull();
  expect(state.counts[state.winner!]).toBeGreaterThanOrEqual(Math.ceil(state.grid.length * state.config.winThreshold));
  expect(state.events.some(event => event.type === 'victory')).toBe(true);
});

it('les combinaisons maximales restent bornées sur les tailles extrêmes', () => {
  for (const [columns, rows] of [[12, 16], [30, 40]]) {
    const state = createMatch({ ...DEFAULT_CONFIG, columns, rows, baseSpeed: 12, winThreshold: 1, spawnSeconds: 1 }, 928);
    for (const team of ['latte', 'roast'] as const) {
      activateBonus(state, 'nitro', team); activateBonus(state, 'nitro', team); activateBonus(state, 'speed', team);
      activateBonus(state, 'colossus', team); activateBonus(state, 'colossus', team);
      activateBonus(state, 'trinity', team); activateBonus(state, 'trinity', team); activateBonus(state, 'infiltrator', team);
    }
    for (let second = 0; second < 60 && !state.winner; second++) { stepMatch(state, TICK_RATE); assertInvariant(state, `${columns}×${rows}, seconde ${second + 1}`); }
  }
});
