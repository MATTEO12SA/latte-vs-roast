import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG, RULES_VERSION } from '../../src/config';
import type { MatchConfig, Team } from '../../src/types';

interface Diagnostics { tick: number; seed: number; version: string; config: MatchConfig; counts: Record<Team, number>; winner: Team | null; paused: boolean; balls: number; effects: string[]; historyLength: number; }
const diagnostics = (page: Page): Promise<Diagnostics> => page.evaluate(() => (window as Window & { __LATTE_DIAGNOSTICS__: () => Diagnostics }).__LATTE_DIAGNOSTICS__());
const shareHash = (data: unknown) => `#partie=${Buffer.from(JSON.stringify(data)).toString('base64url')}`;
const seededURL = (seed = 103, config = DEFAULT_CONFIG) => `./${shareHash({ v: RULES_VERSION, s: seed, c: config })}`;

async function ready(page: Page, url = seededURL(), language: 'en' | 'fr' = 'fr'): Promise<void> {
  await page.goto(url);
  await expect(page.locator('#game')).toBeVisible();
  await expect.poll(async () => (await diagnostics(page)).tick).toBeGreaterThan(0);
  await page.locator('#language-select').selectOption(language);
  await expect(page.locator('html')).toHaveAttribute('lang', language);
}

test('démarrage autonome, pause, reprise et raccourci clavier', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('button', { name: 'Couper le son', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const first = await diagnostics(page);
  expect(first.counts.latte + first.counts.roast).toBe(432);
  await page.getByRole('button', { name: 'Mettre en pause', exact: true }).click();
  await expect.poll(async () => (await diagnostics(page)).paused).toBe(true);
  const pausedTick = (await diagnostics(page)).tick;
  await page.waitForTimeout(200);
  expect((await diagnostics(page)).tick).toBe(pausedTick);
  await expect(page.locator('#pause-overlay')).toBeVisible();
  await page.locator('#resume-button').click();
  await expect.poll(async () => (await diagnostics(page)).tick).toBeGreaterThan(pausedTick);
  await page.locator('body').click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('Space');
  await expect.poll(async () => (await diagnostics(page)).paused).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await diagnostics(page)).paused).toBe(false);
  expect(errors).toEqual([]);
});

test('rejouer conserve la graine, nouvelle partie en choisit une autre', async ({ page }) => {
  await ready(page, seededURL(424242));
  await page.locator('#speed').selectOption('4');
  await expect.poll(async () => (await diagnostics(page)).tick).toBeGreaterThan(180);
  await page.locator('#pause-button').click();
  const before = await diagnostics(page);
  await page.getByRole('button', { name: 'Rejouer la même partie' }).click();
  await expect.poll(async () => (await diagnostics(page)).paused).toBe(false);
  const replay = await diagnostics(page);
  expect(replay.seed).toBe(before.seed);
  expect(replay.tick).toBeLessThan(before.tick);
  await page.getByRole('button', { name: 'Nouvelle partie', exact: true }).click();
  await expect.poll(async () => (await diagnostics(page)).seed).not.toBe(before.seed);
});

test('les règles personnalisées attendent la validation, les préférences persistent', async ({ page }) => {
  await ready(page);
  await page.locator('[data-panel="settings"]').click();
  await expect(page.locator('#columns')).toBeDisabled();
  await page.getByRole('radio', { name: /Personnalisé/ }).check();
  await page.locator('#columns').fill('12');
  await page.locator('#rows').fill('16');
  await page.locator('#base-speed').fill('10');
  await page.locator('#win-threshold').fill('75');
  await page.locator('#spawn-seconds').fill('2');
  await page.locator('#bonus-nitro').uncheck();
  expect((await diagnostics(page)).config).toEqual(DEFAULT_CONFIG);
  await page.locator('#theme-select').selectOption('night');
  await page.locator('#reduced-effects').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.getByRole('button', { name: /Lancer avec ces réglages/ }).click();
  await expect.poll(async () => (await diagnostics(page)).config.columns).toBe(12);
  const custom = (await diagnostics(page)).config;
  expect(custom).toMatchObject({ columns: 12, rows: 16, baseSpeed: 10, winThreshold: 0.75, spawnSeconds: 2 });
  expect(custom.enabledBonuses).not.toContain('nitro');
  await page.reload();
  await expect.poll(async () => (await diagnostics(page)).config).toEqual(custom);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.locator('[data-panel="settings"]').click();
  await expect(page.locator('#reduced-effects')).toBeChecked();
  await expect(page.locator('#bonus-nitro')).not.toBeChecked();
  await page.getByRole('radio', { name: /Fidèle/ }).check();
  await page.getByRole('button', { name: /Lancer avec ces réglages/ }).click();
  await expect.poll(async () => (await diagnostics(page)).config).toEqual(DEFAULT_CONFIG);
});

test('partage une graine et des règles, et sait recharger ce lien', async ({ page }) => {
  const config = { ...DEFAULT_CONFIG, columns: 12, rows: 16, spawnSeconds: 10, enabledBonuses: [] };
  await ready(page, seededURL(90210, config));
  await page.getByRole('button', { name: 'Partager', exact: true }).click();
  await expect(page.locator('#share-dialog')).toBeVisible();
  const url = await page.locator('#share-url').inputValue();
  expect(new URL(url).pathname).toBe('/latte-vs-roast/');
  expect(new URL(url).hash).toMatch(/^#partie=/);
  await page.getByRole('button', { name: 'Copier le lien' }).click();
  await expect(page.locator('#copy-status')).toContainText(/Lien copié|copiez le lien/);
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.goto(url);
  await expect.poll(async () => (await diagnostics(page)).seed).toBe(90210);
  expect((await diagnostics(page)).config).toEqual(config);
});

test('explique les liens incompatibles ou mal formés sans bloquer le jeu', async ({ page }) => {
  await ready(page, `./${shareHash({ v: '99.0.0', s: 5, c: DEFAULT_CONFIG })}`);
  await expect(page.locator('#toast')).toContainText('autre version des règles');
  await ready(page, './#partie=pas-un-json');
  await expect(page.locator('#toast')).toContainText('incomplet ou invalide');
  expect((await diagnostics(page)).config).toEqual(DEFAULT_CONFIG);
});

test('exporte une capture PNG et présente les onze bonus', async ({ page }) => {
  await ready(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('latte-vs-roast-103.png');
  const path = await download.path(); expect(path).toBeTruthy();
  const bytes = await readFile(path!);
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.length).toBeGreaterThan(10000);
  await page.locator('[data-panel="bonuses"]').click();
  await expect(page.locator('#bonus-guide article')).toHaveCount(11);
  await expect(page.getByRole('heading', { name: 'Fantôme d’éclipse', exact: true })).toBeVisible();
});

test('reste utilisable en portrait et en paysage sur petit écran', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const box = await page.locator('#game').boundingBox(); expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(150);
    expect(box!.width / box!.height).toBeCloseTo(18 / 24, 2);
  }
  await page.locator('#pause-button').click();
  await expect.poll(async () => (await diagnostics(page)).paused).toBe(true);
  await page.locator('#resume-button').click();
  await expect.poll(async () => (await diagnostics(page)).paused).toBe(false);
});

test('fonctionne lorsque le stockage local est refusé', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value: () => { throw new DOMException('Refusé', 'SecurityError'); } });
    Object.defineProperty(Storage.prototype, 'setItem', { value: () => { throw new DOMException('Refusé', 'SecurityError'); } });
  });
  await page.goto('./');
  await expect.poll(async () => (await diagnostics(page)).tick).toBeGreaterThan(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#toast')).toContainText(/storage.*unavailable|storage.*not available/i);
  await page.locator('#language-select').selectOption('fr');
  await page.locator('[data-panel="settings"]').click();
  await page.locator('#theme-select').selectOption('contrast');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
  await expect(page.locator('#toast')).toContainText('Vos réglages restent actifs');
  expect(errors).toEqual([]);
});

test('affiche le carnet local et permet de rejouer une partie terminée', async ({ page }) => {
  await page.addInitScript(({ config, version }) => {
    localStorage.setItem('latte-vs-roast.history.v1', JSON.stringify([{ id: 'test-record', date: '2026-11-09T12:00:00.000Z', seed: 6677, config, version, winner: 'latte', ticks: 10560, history: [{ tick: 0, latte: 0.5 }, { tick: 10560, latte: 0.91 }] }]));
  }, { config: DEFAULT_CONFIG, version: RULES_VERSION });
  await ready(page);
  await page.locator('[data-panel="stats"]').click();
  await expect(page.locator('#match-history')).toContainText('Crème remporte le duel');
  await expect(page.locator('#stats-summary')).toContainText('1:28');
  await expect(page.locator('#history-chart polyline')).toHaveCount(1);
  await page.getByRole('button', { name: 'Rejouer la partie 1', exact: true }).click();
  await expect.poll(async () => (await diagnostics(page)).seed).toBe(6677);
});

test('termine une vraie partie et enregistre le résultat une seule fois', async ({ page }) => {
  test.slow();
  const config: MatchConfig = { ...DEFAULT_CONFIG, columns: 12, rows: 16, baseSpeed: 12, winThreshold: 0.7, spawnSeconds: 1, enabledBonuses: ['wreckingBall', 'nitro', 'colossus'] };
  await ready(page, seededURL(17, config));
  await page.clock.install();
  for (let i = 0; i < 24 && !(await diagnostics(page)).winner; i++) await page.clock.runFor(5000);
  const result = await diagnostics(page);
  expect(result.winner).not.toBeNull();
  expect(result.historyLength).toBe(1);
  await expect(page.locator('#victory-overlay')).toBeVisible();
  await expect(page.locator('#winner-title')).toHaveText(/^(Crème|Café) domine !$/);
  await page.clock.runFor(1000);
  expect((await diagnostics(page)).historyLength).toBe(1);
  await page.locator('[data-panel="stats"]').click();
  await expect(page.locator('#match-history .history-row')).toHaveCount(1);
  await expect(page.locator('#history-chart polyline')).toHaveCount(1);
  const finalTick = result.tick;
  await page.locator('#language-select').selectOption('en');
  await expect(page.locator('#winner-title')).toHaveText(/^(Latte|Roast) dominates!$/);
  await expect(page.locator('#victory-overlay')).toBeVisible();
  await expect(page.locator('#match-history')).not.toContainText('remporte le duel');
  expect((await diagnostics(page)).tick).toBe(finalTick);
  expect((await diagnostics(page)).historyLength).toBe(1);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('[data-panel="stats"]').click();
  await expect(page.locator('#match-history .history-row')).toHaveCount(1);
  await expect(page.locator('#history-chart polyline')).toHaveCount(1);
});

test('anglais et son actifs par défaut, avec un sélecteur visible en haut à droite', async ({ page }) => {
  await page.goto(seededURL());
  await expect.poll(async () => (await diagnostics(page)).tick).toBeGreaterThan(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#language-select')).toHaveValue('en');
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sound-button')).toHaveAccessibleName(/mute|turn.*off/i);
  const languageBox = await page.locator('#language-select').boundingBox();
  expect(languageBox).not.toBeNull();
  expect(languageBox!.x).toBeGreaterThan((page.viewportSize()?.width ?? 1280) / 2);
  expect(languageBox!.y).toBeLessThan(100);
  await page.locator('[data-panel="bonuses"]').click();
  await expect(page.getByRole('heading', { name: 'Eclipse Ghost', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Black Hole', exact: true })).toBeVisible();
  await expect(page.locator('#bonus-guide article')).toHaveCount(11);
  await page.locator('#language-select').selectOption('fr');
  await expect(page.getByRole('heading', { name: 'Fantôme d’éclipse', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trou noir', exact: true })).toBeVisible();
});

test('changer de langue conserve la partie en pause et les réglages non appliqués', async ({ page }) => {
  await ready(page, seededURL(303), 'en');
  await page.locator('#pause-button').click();
  const before = await diagnostics(page);
  await page.locator('[data-panel="settings"]').click();
  await page.locator('input[name="profile"][value="custom"]').check();
  await page.locator('#columns').fill('12');
  await page.locator('#rows').fill('16');
  await page.locator('#base-speed').fill('10');
  await page.locator('#bonus-nitro').uncheck();
  await page.locator('#language-select').selectOption('fr');
  await expect(page.locator('#settings-title')).toHaveText('La recette de la partie');
  await expect(page.locator('#columns')).toHaveValue('12');
  await expect(page.locator('#rows')).toHaveValue('16');
  await expect(page.locator('#base-speed')).toHaveValue('10');
  await expect(page.locator('#bonus-nitro')).not.toBeChecked();
  await expect(page.locator('input[name="profile"][value="custom"]')).toBeChecked();
  await expect(page.locator('#columns')).toBeEnabled();
  await expect(page.locator('#pause-overlay')).toBeVisible();
  const after = await diagnostics(page);
  expect(after).toMatchObject({ seed: before.seed, tick: before.tick, counts: before.counts, config: before.config, paused: true });
  await page.locator('#language-select').selectOption('en');
  await expect(page.locator('#settings-title')).not.toHaveText('La recette de la partie');
  await expect(page.locator('#columns')).toHaveValue('12');
  await expect(page.locator('#bonus-nitro')).not.toBeChecked();
});

test('langue et silence choisis persistent, réinitialiser restaure anglais et son', async ({ page }) => {
  await ready(page, seededURL(), 'en');
  await page.locator('#language-select').selectOption('fr');
  await page.locator('#sound-button').click();
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('#language-select')).toHaveValue('fr');
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-panel="settings"]').click();
  await page.locator('#reset-settings').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#language-select')).toHaveValue('en');
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'true');
});

test('sélecteur anglais-français accessible sur 320 et 390 pixels, sans débordement', async ({ page }) => {
  await ready(page, seededURL(), 'en');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const language of ['en', 'fr']) {
      await page.locator('#language-select').selectOption(language);
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const box = await page.locator('#language-select').boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThan(width / 2);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y).toBeLessThan(100);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test('les anciennes préférences adoptent anglais et son actif sans perdre le thème', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('latte-vs-roast.preferences.v1', JSON.stringify({ theme: 'night', sound: false, volume: 0.5, profile: 'faithful' })));
  await page.goto(seededURL());
  await expect.poll(async () => (await diagnostics(page)).tick).toBeGreaterThan(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'true');
});

test('les statistiques de la partie en cours progressent sans attendre une victoire', async ({ page }) => {
  await ready(page, seededURL(103), 'fr');
  await page.clock.install();
  await page.locator('[data-panel="stats"]').click();
  await expect(page.locator('#live-match-stats')).toBeVisible();
  const before = await page.locator('#live-match-stats').innerText();
  await page.clock.runFor(3000);
  await expect.poll(() => page.locator('#live-match-stats').innerText()).not.toBe(before);
  await expect(page.locator('#live-history-chart polyline')).toHaveCount(1);
  const points = await page.locator('#live-history-chart polyline').getAttribute('points');
  await page.clock.runFor(2000);
  await expect(page.locator('#live-history-chart polyline')).not.toHaveAttribute('points', points!);
  await page.locator('#pause-button').click();
  await expect.poll(async () => (await diagnostics(page)).paused).toBe(true);
  await page.clock.runFor(1000);
  const paused = await page.locator('#live-match-stats').innerText();
  await page.clock.runFor(2000);
  await expect.poll(() => page.locator('#live-match-stats').innerText()).toBe(paused);
  expect((await diagnostics(page)).historyLength).toBe(0);
});

test('les anciens résultats restent dans les statistiques mais ne rejouent pas avec de nouvelles règles', async ({ page }) => {
  await page.addInitScript(config => {
    localStorage.setItem('latte-vs-roast.history.v1', JSON.stringify([{ id: 'legacy', date: '2026-11-09T12:00:00.000Z', seed: 123, config, version: '1.0.0', winner: 'roast', ticks: 1200, history: [{ tick: 0, latte: 0.5 }, { tick: 1200, latte: 0.09 }] }]));
  }, DEFAULT_CONFIG);
  await ready(page, seededURL(103), 'fr');
  await page.locator('[data-panel="stats"]').click();
  await expect(page.locator('#match-history .history-row')).toHaveCount(1);
  await expect(page.locator('#match-history')).toContainText('Café remporte le duel');
  await expect(page.locator('#stats-summary')).toContainText('0:10');
  await expect(page.locator('#match-history button')).toBeDisabled();
  await expect(page.locator('#match-history button')).toContainText('Anciennes règles');
  const before = await diagnostics(page);
  await page.locator('#language-select').selectOption('en');
  await expect(page.locator('#match-history button')).toBeDisabled();
  expect((await diagnostics(page)).seed).toBe(before.seed);
});
