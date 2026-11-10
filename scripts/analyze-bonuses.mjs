import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const seeds = Number(option('--seeds', '32'));
const firstSeed = Number(option('--first-seed', '1'));
const output = option('--output', '.local/bonus-impact.json');
const followUpLoot = args.includes('--follow-up-loot');
const snapshotSeconds = [15, 60, 120];
const horizons = [0, 3, 8, 15];
if (!Number.isSafeInteger(seeds) || seeds < 1 || !Number.isSafeInteger(firstSeed) || firstSeed < 0 || firstSeed + seeds > 2 ** 32) throw new Error('Invalid --seeds / --first-seed.');

const describe = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const percentile = p => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
  return {
    n: values.length, mean, median: percentile(0.5), p10: percentile(0.1), p90: percentile(0.9),
    min: sorted[0], max: sorted.at(-1), standardDeviation: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length),
    positive: values.filter(v => v > 0).length, zero: values.filter(v => v === 0).length, negative: values.filter(v => v < 0).length,
  };
};

const engineSha256 = createHash('sha256').update(await readFile('src/engine.ts')).digest('hex');
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
try {
  const { createMatch, stepMatch, activateBonus } = await server.ssrLoadModule('/src/engine.ts');
  const { DEFAULT_CONFIG, RULES_VERSION, BONUS_KINDS, TICK_RATE } = await server.ssrLoadModule('/src/config.ts');
  const results = [];
  const naturalCollections = Object.fromEntries(BONUS_KINDS.map(kind => [kind, { latte: 0, roast: 0 }]));
  let snapshotCount = 0;
  const started = performance.now();
  for (let seed = firstSeed; seed < firstSeed + seeds; seed++) {
    const natural = createMatch(DEFAULT_CONFIG, seed);
    for (const second of snapshotSeconds) {
      while (!natural.winner && natural.tick < second * TICK_RATE) {
        // One-second batches retain important bonus events even on busy frames.
        stepMatch(natural, Math.min(TICK_RATE, second * TICK_RATE - natural.tick));
        for (const event of natural.events) if (event.type === 'bonus') naturalCollections[event.kind][event.team]++;
      }
      if (natural.winner) break;
      snapshotCount++;
      // Retain actual geometry, live balls and effects. Disable only subsequent
      // pickups in BOTH branches so random follow-up loot cannot mask the effect.
      const snapshot = structuredClone(natural);
      if (!followUpLoot) {
        snapshot.pickups = [];
        snapshot.config.enabledBonuses = [];
      }
      const controls = [];
      const control = structuredClone(snapshot);
      let elapsed = 0;
      for (const horizon of horizons) {
        stepMatch(control, (horizon - elapsed) * TICK_RATE);
        controls.push({ counts: { ...control.counts }, winner: control.winner });
        elapsed = horizon;
      }
      for (const team of ['latte', 'roast']) {
        const territoryBefore = snapshot.counts[team];
        const shareBefore = territoryBefore / snapshot.grid.length;
        const position = shareBefore < 0.4 ? 'behind' : shareBefore > 0.6 ? 'ahead' : 'close';
        for (const kind of BONUS_KINDS) {
          const treatment = structuredClone(snapshot);
          const source = treatment.balls.find(ball => ball.team === team && ball.role === 'original');
          const existingCharges = treatment.effects.filter(effect => effect.team === team && effect.kind === kind).length;
          activateBonus(treatment, kind, team, source?.id);
          const row = { seed, second, team, kind, position, territoryBefore, ballsBefore: snapshot.balls.filter(ball => ball.team === team).length, existingCharges, horizons: [] };
          elapsed = 0;
          for (const [index, horizon] of horizons.entries()) {
            stepMatch(treatment, (horizon - elapsed) * TICK_RATE);
            const reference = controls[index];
            row.horizons.push({ seconds: horizon, extraCells: treatment.counts[team] - reference.counts[team], treatmentCells: treatment.counts[team], controlCells: reference.counts[team], treatmentWinner: treatment.winner, controlWinner: reference.winner });
            elapsed = horizon;
          }
          results.push(row);
        }
      }
    }
    if ((seed - firstSeed + 1) % 8 === 0) console.error(`${seed - firstSeed + 1}/${seeds} seeds, ${snapshotCount} snapshots, ${((performance.now() - started) / 1000).toFixed(1)} seconds`);
  }
  const summarize = rows => Object.fromEntries(horizons.map((seconds, index) => [seconds, describe(rows.map(row => row.horizons[index].extraCells))]));
  const bonusSummary = Object.fromEntries(BONUS_KINDS.map(kind => {
    const rows = results.filter(row => row.kind === kind);
    return [kind, {
      all: summarize(rows),
      byTeam: Object.fromEntries(['latte', 'roast'].map(team => [team, summarize(rows.filter(row => row.team === team))])),
      byPosition: Object.fromEntries(['behind', 'close', 'ahead'].map(position => [position, summarize(rows.filter(row => row.position === position))])),
      freshActivation: summarize(rows.filter(row => row.existingCharges === 0)),
      contextualWinsAt15s: {
        treatment: rows.filter(row => row.horizons.at(-1).treatmentWinner === row.team).length,
        control: rows.filter(row => row.horizons.at(-1).controlWinner === row.team).length,
      },
    }];
  }));
  const summary = {
    rulesVersion: RULES_VERSION, engineSha256, config: DEFAULT_CONFIG, firstSeed, seeds, snapshotSeconds, snapshotCount,
    pairedTreatments: results.length, horizons, naturalCollections, followUpLoot,
    method: `Each real match snapshot is copied into paired control/treatment branches for both camps. One bonus is granted to the original ball; all pre-existing effects and balls stay active. ${followUpLoot ? 'Floor pickups and future spawns stay active: this includes indirect pickup benefits but bonus-specific RNG use can change subsequent loot, increasing variance.' : 'Floor pickups and future spawns are removed identically from both branches; indirect benefits from subsequent loot are NOT measured.'} Extra cells means treatment ownership minus control ownership. RNG starts equal but bonus-specific RNG use is retained. Territory trajectories can diverge chaotically; these contextual marginal effects are neither universal power rankings nor a win-probability estimate. Completed branches freeze at victory.`,
    runtimeSeconds: (performance.now() - started) / 1000,
    bonuses: bonusSummary,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ summary, results }, null, 2) + '\n');
  console.log(JSON.stringify({ ...summary, bonuses: Object.fromEntries(BONUS_KINDS.map(kind => [kind, { meanByHorizon: Object.fromEntries(horizons.map(s => [s, bonusSummary[kind].all[s]?.mean])), at15s: bonusSummary[kind].all[15], byPosition15s: Object.fromEntries(['behind', 'close', 'ahead'].map(position => [position, bonusSummary[kind].byPosition[position][15]?.mean])) }])) }, null, 2));
} finally { await server.close(); }
