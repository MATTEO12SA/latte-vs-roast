import { test, expect } from '@playwright/test';

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

test('le bouton sonore tactile démarre, coupe et reprend le son sans bouton de test', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    const probe = { supported: typeof Native === 'function', created: 0, notes: 0, contexts: [] as AudioContext[] };
    Object.defineProperty(window, '__AUDIO_PROBE__', { value: probe });
    // Windows WebKit has no Web Audio; test the explicit fallback there.
    if (!probe.supported) return;
    window.AudioContext = class extends Native {
      constructor() { super(); probe.created++; probe.contexts.push(this); }
      createOscillator(): OscillatorNode { probe.notes++; return super.createOscillator(); }
    };
  });
  const probe = () => page.evaluate(() => {
    const p = (window as Window & { __AUDIO_PROBE__: { supported: boolean; created: number; notes: number; contexts: AudioContext[] } }).__AUDIO_PROBE__;
    return { supported: p.supported, created: p.created, notes: p.notes, running: p.contexts.some(c => c.state === 'running') };
  });
  await page.goto('./');
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'true');
  expect((await probe()).created).toBe(0);
  await page.locator('#sound-button').tap();
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'true');
  if ((await probe()).supported) {
    await expect.poll(async () => (await probe()).running).toBe(true);
    await expect.poll(async () => (await probe()).notes).toBeGreaterThan(0);
  } else await expect(page.locator('#toast')).toContainText('does not support game audio');
  await expect(page.locator('#sound-button')).toHaveAccessibleName('Mute sound');
  await page.locator('#sound-button').tap();
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'false');
  const mutedNotes = (await probe()).notes;
  await page.waitForTimeout(150);
  expect((await probe()).notes).toBe(mutedNotes);
  await page.locator('#sound-button').tap();
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'true');
  if ((await probe()).supported) await expect.poll(async () => (await probe()).notes).toBeGreaterThan(mutedNotes);
  await page.locator('#language-select').selectOption('fr');
  await expect(page.locator('#sound-button')).toHaveAccessibleName('Couper le son');
  await page.locator('[data-panel="settings"]').tap();
  await expect(page.locator('#sound-test')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
