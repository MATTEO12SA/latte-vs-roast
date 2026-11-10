import { describe, expect, it } from 'vitest';
import { activateBonus, createMatch, stepMatch } from '../src/engine';
import { DEFAULT_CONFIG } from '../src/config';

describe('régressions de conquête', () => {
  it.each(['latte', 'roast'] as const)('une capture complète par %s ne ressuscite pas le camp éliminé', winner => {
    const s = createMatch({ ...DEFAULT_CONFIG, winThreshold: 1, enabledBonuses: [] }, 123);
    const loser = winner === 'latte' ? 'roast' : 'latte';
    s.grid.fill(winner === 'latte' ? 0 : 1); s.grid[6 * 18 + 9] = winner === 'latte' ? 1 : 0;
    s.counts = { latte: winner === 'latte' ? 431 : 1, roast: winner === 'roast' ? 431 : 1 }; s.revision++;
    const attacking = s.balls.find(b => b.team === winner)!;
    const defending = s.balls.find(b => b.team === loser)!;
    // Always process the attacking ball first to expose same-tick resurrection,
    // independently of which camp happens to be first in the original array.
    s.balls = [attacking, defending];
    Object.assign(attacking, { x: 8.5, y: 6.5, vx: 8, vy: 0 });
    Object.assign(defending, { x: 9.5, y: 6.5, vx: 8, vy: 0 });
    stepMatch(s, 3);
    expect(s.winner).toBe(winner);
    expect(s.counts[winner]).toBe(432);
    expect(s.counts[loser]).toBe(0);
    expect(s.events.filter(e => e.type === 'victory')).toHaveLength(1);
  });

  it('une collecte de téléportation ne ramasse pas les objets sur le segment quitté', () => {
    const s = createMatch({ ...DEFAULT_CONFIG, enabledBonuses: [] }, 14);
    const b = s.balls[0]; s.balls = [b];
    activateBonus(s, 'nitro', 'latte'); activateBonus(s, 'nitro', 'latte'); activateBonus(s, 'speed', 'latte');
    Object.assign(b, { x: 2.95, y: 3.1, vx: 0, vy: -32 });
    // Adjacent non-overlapping cells; neither pickup touches the ball initially.
    // At high speed, the old segment reaches the wormhole first, then Colossus.
    s.pickups = [
      { id: 90, kind: 'wormhole', x: 2.5, y: 2.5, expiresAt: 500 },
      { id: 91, kind: 'colossus', x: 3.5, y: 2.5, expiresAt: 500 },
    ];
    stepMatch(s, 1);
    expect(Math.hypot(b.x - 2.5, b.y - 2.5)).toBeGreaterThan(5);
    expect(s.pickups.map(p => p.id)).toContain(91);
    expect(s.effects.some(e => e.kind === 'colossus')).toBe(false);
  });

  it('des bonus répétés ne créent pas de renforts au-delà de la limite', () => {
    const s = createMatch({ ...DEFAULT_CONFIG, winThreshold: 1, enabledBonuses: [] }, 42);
    for (let i = 0; i < 50; i++) {
      activateBonus(s, 'trinity', 'latte');
      activateBonus(s, 'infiltrator', 'latte');
      activateBonus(s, 'nitro', 'latte');
      activateBonus(s, 'colossus', 'latte');
      stepMatch(s, 1);
      expect(s.balls.filter(b => b.team === 'latte').length).toBeLessThanOrEqual(7);
      expect(s.effects.filter(e => e.team === 'latte' && e.kind === 'nitro').length).toBeLessThanOrEqual(2);
      expect(s.effects.filter(e => e.team === 'latte' && e.kind === 'colossus').length).toBeLessThanOrEqual(2);
    }
  });
});
