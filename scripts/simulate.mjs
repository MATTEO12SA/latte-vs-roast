import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// Run the same TypeScript engine as the browser, without rendering or audio.
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const count = Number(option('--count', '300'));
const limitSeconds = Number(option('--limit', '7200'));
const firstSeed = Number(option('--first-seed', '1'));
const output = option('--output', '.local/durations.json');
if (![count, limitSeconds, firstSeed].every(Number.isSafeInteger) || count < 1 || limitSeconds < 1 || firstSeed < 0 || firstSeed + count > 2 ** 32) {
  throw new Error('Use positive integer --count / --limit and unsigned 32-bit seeds.');
}
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
try {
  const { createMatch, stepMatch } = await server.ssrLoadModule('/src/engine.ts');
  const { DEFAULT_CONFIG, RULES_VERSION, TICK_RATE, normalizeConfig } = await server.ssrLoadModule('/src/config.ts');
  const config = normalizeConfig({ ...DEFAULT_CONFIG, ...JSON.parse(option('--config', '{}')) });
  const results = [];
  const started = performance.now();
  for (let seed = firstSeed; seed < firstSeed + count; seed++) {
    const state = createMatch(config, seed);
    while (!state.winner && state.tick < limitSeconds * TICK_RATE) stepMatch(state, Math.min(TICK_RATE, limitSeconds * TICK_RATE - state.tick));
    results.push({ seed, seconds: state.tick / TICK_RATE, winner: state.winner });
    if (results.length % 25 === 0) console.error(`${results.length}/${count} matches (${((performance.now() - started) / 1000).toFixed(1)}s CPU wall time)`);
  }
  const finished = results.filter(r => r.winner).map(r => r.seconds).sort((a, b) => a - b);
  const quantile = p => finished.length ? finished[Math.max(0, Math.ceil(p * finished.length) - 1)] : null;
  const summary = {
    version: RULES_VERSION, config, firstSeed, count, limitSeconds,
    completed: finished.length, censored: count - finished.length,
    // Censored matches are never counted as wins or included in the mean.
    completedMeanSeconds: finished.length ? finished.reduce((a, b) => a + b, 0) / finished.length : null,
    completedMedianSeconds: quantile(0.5), completedP90Seconds: quantile(0.9), completedP95Seconds: quantile(0.95),
    completedMinSeconds: finished[0] ?? null, completedMaxSeconds: finished.at(-1) ?? null,
    observedMeanAtLimitSeconds: results.reduce((sum, result) => sum + result.seconds, 0) / count,
    over10Minutes: results.filter(r => r.seconds > 600).length,
    over20Minutes: results.filter(r => r.seconds > 1200).length,
    wins: { latte: results.filter(r => r.winner === 'latte').length, roast: results.filter(r => r.winner === 'roast').length },
    runtimeSeconds: (performance.now() - started) / 1000
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ summary, results }, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
} finally { await server.close(); }
