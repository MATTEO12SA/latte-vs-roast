import { describe, expect, it } from 'vitest';
import { activateBonus, createMatch, stepMatch } from '../src/engine';
import { BASE_RADIUS, BONUS_KINDS, DEFAULT_CONFIG, MAX_BALLS, TICK_RATE } from '../src/config';
import { circleOverlapsCell } from '../src/physics';
import type { MatchState, Team } from '../src/types';

const isolated = (seed = 123) => createMatch({ ...DEFAULT_CONFIG, baseSpeed: 8, enabledBonuses: [], winThreshold: 1 }, seed);
const teamValue = (team: Team) => team === 'latte' ? 0 : 1;
function assertState(s: MatchState): void {
  const latte = s.grid.filter(c => c === 0).length;
  expect(s.counts).toEqual({ latte, roast: s.grid.length - latte });
  for (const team of ['latte', 'roast'] as const) expect(s.balls.filter(b => b.team === team).length).toBeLessThanOrEqual(MAX_BALLS);
  for (const b of s.balls) {
    expect([b.x, b.y, b.vx, b.vy, b.radius].every(Number.isFinite)).toBe(true);
    expect(b.x).toBeGreaterThanOrEqual(b.radius - 1e-6);
    expect(b.y).toBeGreaterThanOrEqual(b.radius - 1e-6);
    expect(b.x).toBeLessThanOrEqual(s.config.columns - b.radius + 1e-6);
    expect(b.y).toBeLessThanOrEqual(s.config.rows - b.radius + 1e-6);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThanOrEqual(32 + 1e-6);
  }
}

describe('contrats des bonus et interactions', () => {
  it.each([1, 2])('Infiltrateur reste derrière les lignes avec %s charge(s) Colosse', charges => {
    for (const team of ['latte', 'roast'] as const) {
      const s = isolated();
      for (let i = 0; i < charges; i++) activateBonus(s, 'colossus', team);
      activateBonus(s, 'infiltrator', team);
      const b = s.balls.find(b => b.team === team && b.role === 'infiltrator')!;
      expect(b).toBeDefined();
      expect(b.radius).toBeCloseTo(BASE_RADIUS * (charges === 1 ? 2.5 : 5));
      expect(team === 'latte' ? b.x >= 9 : b.x < 9).toBe(true);
      for (let row = 0; row < s.config.rows; row++) for (let col = 0; col < s.config.columns; col++) {
        if (circleOverlapsCell(b.x, b.y, b.radius, col, row)) expect(s.grid[row * s.config.columns + col]).toBe(teamValue(team));
      }
      stepMatch(s, TICK_RATE);
      assertState(s);
    }
  });

  it('collecte dans l’ordre des contacts, indépendamment de l’ordre de stockage', () => {
    const run = (reverse: boolean) => {
      const s = isolated(); const b = s.balls[0]; s.balls = [b];
      activateBonus(s, 'nitro', 'latte'); activateBonus(s, 'nitro', 'latte');
      s.config.baseSpeed = 12;
      Object.assign(b, { x: 2.95, y: 3.1, vx: 0, vy: -32 });
      const pickups = [
        { id: 90, kind: 'speed' as const, x: 2.5, y: 2.5, expiresAt: 500 },
        { id: 91, kind: 'wormhole' as const, x: 3.5, y: 2.5, expiresAt: 500 },
      ];
      s.pickups = reverse ? pickups.reverse() : pickups;
      stepMatch(s, 1);
      return { events: s.events.filter(e => e.type === 'bonus').map(e => e.kind), balls: s.balls, pickups: s.pickups };
    };
    expect(run(false).events).toEqual(['speed', 'wormhole']);
    expect(run(true)).toEqual(run(false));
  });

  it('Nitro accélère dès le contact, pendant le reste de la même étape', () => {
    const s = isolated(); const b = s.balls[0]; s.balls = [b];
    Object.assign(b, { x: 2.4, y: 3.5, vx: 8, vy: 0 });
    s.pickups = [{ id: 90, kind: 'nitro', x: 3.1, y: 3.5, expiresAt: 500 }];
    stepMatch(s, 1);
    const beforePickup = (3.1 - 2.4 - BASE_RADIUS - 0.32) / 8;
    expect(b.x).toBeCloseTo(2.4 + 8 * beforePickup + 16 * (1 / TICK_RATE - beforePickup), 6);
    expect(s.pickups).toHaveLength(0);
  });

  it('Colosse conquiert une façade plus large, sans la profondeur de Démolition', () => {
    const s = isolated(); const b = s.balls[0]; s.balls = [b];
    activateBonus(s, 'colossus', 'latte');
    Object.assign(b, { x: 9 - b.radius - 0.01, y: 6.5, vx: 8, vy: 0 });
    stepMatch(s, 1);
    expect([5, 6, 7].map(row => s.grid[row * 18 + 9])).toEqual([0, 0, 0]);
    expect(s.grid[6 * 18 + 10]).toBe(1);
    expect(b.vx).toBeLessThan(0);
  });

  it('Trou noir protège les alliés et ralentit les adversaires dans sa zone', () => {
    const s = isolated(); const ally = s.balls[0], enemy = s.balls[1];
    activateBonus(s, 'blackHole', 'latte');
    const hole = s.vortexes[0];
    expect(Math.hypot(hole.x - enemy.x, hole.y - enemy.y)).toBeLessThanOrEqual(1.5 + 1e-6);
    hole.x = 9.5; hole.y = 12.5;
    Object.assign(ally, { x: hole.x - 2, y: hole.y, vx: 0, vy: 8 });
    Object.assign(enemy, { x: hole.x + 1, y: hole.y, vx: 0, vy: 8 });
    stepMatch(s, 1);
    expect(Math.hypot(ally.vx, ally.vy)).toBeCloseTo(8);
    expect(ally.vx).toBeCloseTo(0);
    expect(Math.hypot(enemy.vx, enemy.vy)).toBeCloseTo(8 * 0.65);
    expect(enemy.vx).toBeLessThan(0);
    Object.assign(enemy, { x: hole.x, y: hole.y });
    stepMatch(s, 1);
    expect(enemy.capturedBy).toBe(hole.id);
    const capturePosition = { x: enemy.x, y: enemy.y };
    stepMatch(s, 41);
    expect({ x: enemy.x, y: enemy.y }).toEqual(capturePosition);
    stepMatch(s, 1);
    expect(enemy.capturedBy).toBeNull();
    expect(enemy.holeCooldownUntil).toBe(s.tick + TICK_RATE);
    expect(Math.hypot(enemy.vx, enemy.vy)).toBeCloseTo(8);
    stepMatch(s, 6 * TICK_RATE);
    expect(s.vortexes).toHaveLength(0);
    assertState(s);
  });

  it('la disparition d’un vortex libère immédiatement sa bille captive', () => {
    const s = isolated(); activateBonus(s, 'blackHole', 'latte');
    const enemy = s.balls[1], hole = s.vortexes[0];
    hole.x = enemy.x; hole.y = enemy.y;
    stepMatch(s, 1); expect(enemy.capturedBy).toBe(hole.id);
    s.vortexes = []; stepMatch(s, 1);
    expect(enemy.capturedBy).toBeNull();
    expect(Math.hypot(enemy.vx, enemy.vy)).toBeCloseTo(8);
  });

  it('la tourelle réalise bien ses huit tirs, puis tous les projectiles expirent', () => {
    const s = isolated(); const b = s.balls[0];
    Object.assign(b, { x: 7.5, y: 12.5 });
    activateBonus(s, 'turret', 'latte'); s.balls = [];
    stepMatch(s, 9 * TICK_RATE);
    expect(s.counts.latte).toBe(216 + 8);
    expect(s.turrets).toHaveLength(0);
    stepMatch(s, 4 * TICK_RATE);
    expect(s.projectiles).toHaveLength(0);
  });

  it('Vitesse se renouvelle, les troisièmes charges Nitro/Colosse remplacent la plus ancienne', () => {
    const s = isolated();
    for (const kind of ['speed', 'nitro', 'colossus'] as const) {
      activateBonus(s, kind, 'latte');
      stepMatch(s, 30); activateBonus(s, kind, 'latte');
      stepMatch(s, 30); activateBonus(s, kind, 'latte');
      const effects = s.effects.filter(e => e.kind === kind);
      expect(effects).toHaveLength(kind === 'speed' ? 1 : 2);
      expect(Math.max(...effects.map(e => e.expiresAt))).toBe(s.tick + (kind === 'nitro' ? 10 : 8) * TICK_RATE);
    }
    assertState(s);
  });

  it('toutes les paires de bonus restent bornées et expirent sans entité résiduelle', () => {
    for (const first of BONUS_KINDS) for (const second of BONUS_KINDS) {
      const s = isolated(7919);
      for (const team of ['latte', 'roast'] as const) { activateBonus(s, first, team); activateBonus(s, second, team); }
      for (let second = 0; second < 22 && !s.winner; second++) { stepMatch(s, TICK_RATE); assertState(s); }
      if (!s.winner) {
        expect(s.effects).toHaveLength(0);
        expect(s.vortexes).toHaveLength(0);
        expect(s.turrets).toHaveLength(0);
        expect(s.projectiles).toHaveLength(0);
        expect(s.balls).toHaveLength(2);
      }
    }
  }, 120000);
});
