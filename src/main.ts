import './styles.css';
import { BONUS_KINDS, DEFAULT_CONFIG, defaultPreferences, formatTime, normalizeConfig, RULES_VERSION, TICK_RATE } from './config';
import { applyStaticTranslations, bonusInfo, localizedTeamName, localeFor, t } from './i18n';
import { createMatch, stepMatch } from './engine';
import { GameRenderer } from './renderer';
import { GameAudio } from './audio';
import { loadPreferences, loadRecords, makeShareURL, parseShare, recordMatch, savePreferences, saveRecords, storageAvailable } from './storage';
import type { Language, MatchConfig, ThemeName } from './types';

const el = <T extends HTMLElement = HTMLElement>(id: string): T => { const element = document.getElementById(id); if (!element) throw new Error(`Élément absent : ${id}`); return element as T; };
const icon = (name: string) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const faithful = (config: MatchConfig) => JSON.stringify(config) === JSON.stringify(DEFAULT_CONFIG);
let preferences = loadPreferences();
const text = (french: string) => t(french, preferences.language);
const teamName = (team: 'latte' | 'roast') => localizedTeamName(team, preferences.language);
const decimal = (value: number) => value.toLocaleString(localeFor(preferences.language), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
let records = loadRecords();
const shared = parseShare(window.location.hash);
const initialConfig = shared && !('error' in shared) ? shared.config : preferences.profile === 'custom' ? preferences.customConfig : DEFAULT_CONFIG;
let state = createMatch(initialConfig, shared && !('error' in shared) ? shared.seed : randomSeed());
let paused = false;
let backgroundPaused = document.hidden;
let speed = 1;
let accumulator = 0;
let lastFrame = performance.now();
let hudUpdatedAt = -1;
let liveUpdatedAt = -1;
let lastEffectSignature = '';
let matchId = `${Date.now()}-${state.seed}`;
let saved = false;
let toastTimer = 0;
let toastMessage = '';
let copyMessage = '';
let openPanel: string | null = null;
const renderer = new GameRenderer(el<HTMLCanvasElement>('game'));
const audio = new GameAudio(() => updateSoundButton());

function updateSoundButton(): void {
  const sound = el<HTMLButtonElement>('sound-button');
  sound.innerHTML = icon(preferences.sound ? 'sound' : 'mute');
  const label = text(preferences.sound && audio.hasInteraction ? 'Couper le son' : 'Activer le son');
  sound.setAttribute('aria-label', label); sound.title = label;
  sound.setAttribute('aria-pressed', String(preferences.sound));
}

function toast(message: string, duration = 4200): void {
  toastMessage = message;
  const target = el('toast'); target.textContent = text(message); target.hidden = false;
  window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { target.hidden = true; }, duration);
}
function persistPreferences(): void { if (!savePreferences(preferences)) toast('Le stockage est indisponible. Vos réglages restent actifs pour cette visite.'); }
function setAppearance(): void {
  document.documentElement.dataset.theme = preferences.theme;
  el<HTMLSelectElement>('theme-select').value = preferences.theme;
  el<HTMLInputElement>('volume').value = String(Math.round(preferences.volume * 100));
  el('volume-value').textContent = `${Math.round(preferences.volume * 100)} %`;
  el<HTMLInputElement>('reduced-effects').checked = preferences.reducedEffects;
  audio.set(preferences.sound, preferences.volume);
}
function populateSettings(): void {
  const c = preferences.customConfig;
  document.querySelector<HTMLInputElement>(`input[name="profile"][value="${preferences.profile}"]`)!.checked = true;
  el<HTMLFieldSetElement>('custom-fields').disabled = preferences.profile !== 'custom';
  el<HTMLInputElement>('columns').value = String(c.columns);
  el<HTMLInputElement>('rows').value = String(c.rows);
  el<HTMLInputElement>('base-speed').value = String(c.baseSpeed);
  el<HTMLInputElement>('win-threshold').value = String(Math.round(c.winThreshold * 100));
  el<HTMLInputElement>('spawn-seconds').value = String(c.spawnSeconds);
  for (const kind of BONUS_KINDS) el<HTMLInputElement>(`bonus-${kind}`).checked = c.enabledBonuses.includes(kind);
  setAppearance();
}
function updatePause(): void {
  const stopped = paused || backgroundPaused;
  el('pause-overlay').hidden = !stopped || state.winner !== null;
  const button = el<HTMLButtonElement>('pause-button');
  button.innerHTML = `${icon(stopped ? 'play' : 'pause')}<span>${text(stopped ? 'Reprendre' : 'Pause')}</span>`;
  button.setAttribute('aria-label', text(stopped ? 'Reprendre la partie' : 'Mettre en pause'));
  button.disabled = state.winner !== null;
  el('status-text').textContent = text(state.winner ? 'La bataille est terminée' : stopped ? 'La bataille se repose' : 'La bataille infuse');
  el('status-dot').classList.toggle('paused', stopped || state.winner !== null);
  updateLiveStats(true);
}
function setPaused(value: boolean): void { paused = value; accumulator = 0; updatePause(); if (!value) audio.unlock(); }
function startMatch(config: MatchConfig, seed = randomSeed(), preserveLink = false): void {
  state = createMatch(normalizeConfig(config), seed);
  matchId = `${Date.now()}-${state.seed}`; saved = false; paused = false; backgroundPaused = document.hidden;
  accumulator = 0; lastFrame = performance.now(); lastEffectSignature = ''; hudUpdatedAt = -1;
  renderer.reset(); el('victory-overlay').hidden = true;
  if (!preserveLink && location.hash.startsWith('#partie=')) history.replaceState(null, '', `${location.pathname}${location.search}`);
  updatePause(); updateHUD(true); audio.unlock();
  updateLiveStats(true);
}
function currentRecipe(): MatchConfig { return preferences.profile === 'custom' ? preferences.customConfig : DEFAULT_CONFIG; }

function updateEffects(): void {
  const effects = state.effects.filter(effect => effect.expiresAt > state.tick);
  const signature = effects.map(e => `${e.id}:${Math.ceil((e.expiresAt - state.tick) / 120)}`).join(',');
  if (signature === lastEffectSignature && el('active-effects').children.length > 0) return;
  lastEffectSignature = signature;
  const target = el('active-effects');
  target.classList.toggle('effect-stack', effects.length > 5);
  if (!effects.length) { target.innerHTML = `<span class="calm-label">${text('Deux nuances. Un seul territoire.')}</span>`; return; }
  target.innerHTML = effects.map(effect => {
    const info = bonusInfo(effect.kind, preferences.language), remaining = Math.ceil((effect.expiresAt - state.tick) / TICK_RATE);
    const percent = Math.max(0, Math.min(100, (effect.expiresAt - state.tick) / (effect.expiresAt - effect.startedAt) * 100));
    return `<div class="effect-banner ${effect.team}" title="${teamName(effect.team)} · ${info.description}"><span>${info.icon}</span><span>${info.name}</span><span class="effect-time">${remaining}s</span><i class="effect-progress" style="width:${percent}%"></i></div>`;
  }).join('');
}
function updateHUD(force = false): void {
  if (!force && state.tick - hudUpdatedAt < 6) return;
  hudUpdatedAt = state.tick;
  const total = state.grid.length;
  for (const team of ['latte', 'roast'] as const) {
    const p = state.counts[team] / total * 100;
    el(`${team}-bar`).style.width = `${p}%`;
    el(`${team}-percent`).textContent = `${decimal(p)} %`;
  }
  el('clock').textContent = formatTime(state.tick);
  el('profile-label').textContent = text(faithful(state.config) ? 'FIDÈLE' : 'SUR MESURE');
  el('seed-label').textContent = `${text('GRAINE')} ${state.seed.toString(16).toUpperCase().padStart(8, '0')}`;
  el('target-label').textContent = `${Math.round(state.config.winThreshold * 100)} %`;
  el('game-shell').style.setProperty('--board-ratio', String(state.config.columns / state.config.rows));
  document.querySelectorAll<HTMLElement>('.win-marker').forEach(marker => { marker.style.left = `${state.config.winThreshold * 100}%`; });
  updateEffects();
  updateLiveStats(force);
}
function finishMatch(): void {
  if (!state.winner || saved) return;
  saved = true;
  records = [recordMatch(state, matchId), ...records.map(record => ({ ...record, history: [] }))].slice(0, 100);
  if (!saveRecords(records)) toast('Partie terminée. L’historique n’a pas pu être enregistré dans ce navigateur.');
  el('victory-overlay').hidden = false;
  updateVictory();
  updatePause(); updateHUD(true); renderStats();
}
function updateVictory(): void {
  if (!state.winner) return;
  el('winner-title').textContent = `${teamName(state.winner)} ${text('domine !')}`;
  el('winner-detail').textContent = `${formatTime(state.tick)} ${text('de bataille')} · ${decimal(state.counts[state.winner] / state.grid.length * 100)} % ${text('du territoire')}`;
}
function frame(now: number): void {
  const delta = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
  if (!paused && !backgroundPaused && !state.winner) {
    accumulator += delta * speed * TICK_RATE;
    const ticks = Math.floor(accumulator); accumulator -= ticks;
    if (ticks) { stepMatch(state, ticks); renderer.consumeEvents(state.events); audio.consume(state.events); }
    updateHUD(); finishMatch();
  }
  renderer.renderMatch(state, { theme: preferences.theme, reducedEffects: preferences.reducedEffects, delta: paused || backgroundPaused ? 0 : delta });
  requestAnimationFrame(frame);
}

function renderStats(): void {
  updateLiveStats(true);
  const latte = records.filter(r => r.winner === 'latte').length;
  const mean = records.length ? Math.round(records.reduce((sum, r) => sum + r.ticks, 0) / records.length) : 0;
  el('stats-summary').innerHTML = `<div class="stat-card"><strong>${latte}</strong><span>${text('victoires Crème')}</span></div><div class="stat-card"><strong>${records.length - latte}</strong><span>${text('victoires Café')}</span></div><div class="stat-card"><strong>${records.length ? formatTime(mean) : '—'}</strong><span>${text('durée moyenne')}</span></div>`;
  const chart = el<SVGElement & HTMLElement>('history-chart');
  const samples = records[0]?.history ?? [];
  if (samples.length) {
    const end = Math.max(1, samples[samples.length - 1].tick);
    const points = samples.map(p => `${(12 + p.tick / end * 576).toFixed(2)},${(142 - p.latte * 126).toFixed(2)}`).join(' ');
    chart.innerHTML = `<path d="M12 16H588M12 79H588M12 142H588" stroke="currentColor" opacity=".08"/><polygon points="12,142 ${points} 588,142" fill="var(--accent)" fill-opacity=".08" stroke="none"/><polyline points="${points}" stroke="var(--accent)" stroke-width="2" fill="none"/><text x="12" y="157" fill="var(--muted)" stroke="none" font-size="8">0:00</text><text x="588" y="157" text-anchor="end" fill="var(--muted)" stroke="none" font-size="8">${formatTime(end)}</text>`;
  } else chart.innerHTML = `<path d="M12 79H588" stroke="currentColor" opacity=".12" stroke-dasharray="4 6"/><text x="300" y="65" text-anchor="middle" fill="var(--muted)" stroke="none" font-size="11">${text('La courbe apparaîtra après votre premier duel.')}</text>`;
  const target = el('match-history'); target.replaceChildren();
  if (!records.length) { target.innerHTML = `<p class="empty-history">${text('Le carnet est encore vierge. Laissez une partie se terminer pour découvrir ses résultats.')}</p>`; return; }
  records.forEach((record, index) => {
    const row = document.createElement('div'); row.className = 'history-row';
    const label = document.createElement('div'), strong = document.createElement('strong'), small = document.createElement('small');
    strong.textContent = `${teamName(record.winner)} ${text('remporte le duel')}`;
    small.textContent = `${new Date(record.date).toLocaleDateString(localeFor(preferences.language), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${text(faithful(record.config) ? 'Fidèle' : 'Sur mesure')}`;
    label.append(strong, small);
    const time = document.createElement('time'); time.textContent = formatTime(record.ticks);
    const replay = document.createElement('button'); replay.className = 'quiet-button'; replay.textContent = text('Rejouer ↗'); replay.setAttribute('aria-label', `${text('Rejouer la partie')} ${index + 1}`);
    if (record.version !== RULES_VERSION) { replay.disabled = true; replay.textContent = text('Anciennes règles'); replay.title = text('Cette partie utilise une autre version des règles et ne peut pas être rejouée ici.'); }
    replay.addEventListener('click', () => { startMatch(record.config, record.seed); el('game-shell').scrollIntoView({ behavior: preferences.reducedEffects ? 'instant' : 'smooth', block: 'start' }); });
    row.append(label, time, replay); target.append(row);
  });
}

function updateLiveStats(force = false): void {
  if (openPanel !== 'stats' && !force) return;
  if (!force && state.tick - liveUpdatedAt < TICK_RATE / 2) return;
  liveUpdatedAt = state.tick;
  el('live-elapsed').textContent = formatTime(state.tick);
  el('live-latte').textContent = `${decimal(state.counts.latte / state.grid.length * 100)} %`;
  el('live-roast').textContent = `${decimal(state.counts.roast / state.grid.length * 100)} %`;
  el('live-balls').textContent = String(state.balls.length);
  el('live-status').textContent = text(state.winner ? 'Partie terminée' : paused || backgroundPaused ? 'Partie en pause' : 'En direct');
  const end = Math.max(1, state.tick);
  const samples = [...state.history, { tick: state.tick, latte: state.counts.latte / state.grid.length }];
  const points = samples.map(p => `${(12 + p.tick / end * 576).toFixed(2)},${(142 - p.latte * 126).toFixed(2)}`).join(' ');
  el<SVGElement & HTMLElement>('live-chart-line').setAttribute('points', points);
  el<SVGElement & HTMLElement>('live-chart-area').setAttribute('points', `12,142 ${points} 588,142`);
  el('live-chart-time').textContent = formatTime(state.tick);
}

function localize(): void {
  applyStaticTranslations(preferences.language);
  el<HTMLSelectElement>('language-select').value = preferences.language;
  // Only labels are updated: draft fields and selected power-ups stay intact.
  for (const kind of BONUS_KINDS) el<HTMLInputElement>(`bonus-${kind}`).nextElementSibling!.textContent = bonusInfo(kind, preferences.language).name;
  el('bonus-guide').innerHTML = BONUS_KINDS.map(kind => { const info = bonusInfo(kind, preferences.language); return `<article class="bonus-card"><span class="bonus-icon" aria-hidden="true">${info.icon}</span><div><h3>${info.name}</h3><p>${info.description}</p></div></article>`; }).join('');
  lastEffectSignature = '!language';
  updatePause(); updateHUD(true); updateVictory(); renderStats(); setAppearance();
  if (!el('toast').hidden) el('toast').textContent = text(toastMessage);
  el('copy-status').textContent = text(copyMessage);
}
el('bonus-toggles').innerHTML = BONUS_KINDS.map(kind => `<label class="bonus-toggle"><input type="checkbox" id="bonus-${kind}" checked><span></span></label>`).join('');
populateSettings(); localize();
el<HTMLSelectElement>('language-select').addEventListener('change', event => {
  preferences.language = (event.target as HTMLSelectElement).value as Language;
  localize(); persistPreferences();
});

el('pause-button').addEventListener('click', () => setPaused(!paused));
el('resume-button').addEventListener('click', () => setPaused(false));
el('restart-button').addEventListener('click', () => startMatch(state.config, state.seed));
el('victory-replay').addEventListener('click', () => startMatch(state.config, state.seed));
for (const id of ['new-button', 'victory-new']) el(id).addEventListener('click', () => startMatch(currentRecipe()));
el<HTMLSelectElement>('speed').addEventListener('change', event => { speed = Number((event.target as HTMLSelectElement).value); });
document.addEventListener('keydown', event => {
  const target = event.target as HTMLElement;
  if (!target.closest('#sound-button')) void audio.unlock();
  if (event.code === 'Space' && !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(target.tagName) && !el<HTMLDialogElement>('share-dialog').open) { event.preventDefault(); if (!state.winner) setPaused(!paused); }
  if (event.key === 'Escape') el('game-shell').classList.remove('expanded');
});
document.addEventListener('visibilitychange', () => { backgroundPaused = document.hidden; accumulator = 0; lastFrame = performance.now(); audio.setBackground(document.hidden); updatePause(); });
const unlockFromGesture = (event: Event) => { if (!(event.target as HTMLElement).closest('#sound-button')) void audio.unlock(); };
document.addEventListener('pointerdown', unlockFromGesture);
document.addEventListener('touchend', unlockFromGesture, { passive: true });
document.addEventListener('click', unlockFromGesture);
el('sound-button').addEventListener('click', () => {
  // A first tap must unlock pending audio, not accidentally turn it off.
  preferences.sound = !preferences.sound || !audio.hasInteraction;
  setAppearance(); persistPreferences();
  if (preferences.sound) void audio.unlock().then(ready => {
    if (preferences.sound && !ready) toast(audio.supported ? 'Le navigateur bloque encore le son. Touchez à nouveau le bouton du son.' : 'Ce navigateur ne prend pas en charge le son du jeu.');
  });
});
el('fullscreen-button').addEventListener('click', async () => {
  const shell = el('game-shell');
  try { if (document.fullscreenElement) await document.exitFullscreen(); else if (shell.requestFullscreen) await shell.requestFullscreen(); else shell.classList.toggle('expanded'); }
  catch { shell.classList.toggle('expanded'); }
});
document.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(button => button.addEventListener('click', () => {
  const chosen = button.dataset.panel!; openPanel = openPanel === chosen ? null : chosen;
  for (const name of ['settings', 'bonuses', 'stats']) { el(`${name}-panel`).hidden = name !== openPanel; const tab = document.querySelector<HTMLButtonElement>(`[data-panel="${name}"]`)!; tab.setAttribute('aria-expanded', String(name === openPanel)); tab.querySelector('span')!.textContent = name === openPanel ? '−' : '+'; }
  if (openPanel === 'stats') renderStats();
}));
document.querySelectorAll<HTMLInputElement>('input[name="profile"]').forEach(input => input.addEventListener('change', () => { el<HTMLFieldSetElement>('custom-fields').disabled = input.value !== 'custom'; }));
el('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  preferences.profile = document.querySelector<HTMLInputElement>('input[name="profile"]:checked')!.value === 'custom' ? 'custom' : 'faithful';
  preferences.customConfig = normalizeConfig({ columns: Number(el<HTMLInputElement>('columns').value), rows: Number(el<HTMLInputElement>('rows').value), baseSpeed: Number(el<HTMLInputElement>('base-speed').value), winThreshold: Number(el<HTMLInputElement>('win-threshold').value) / 100, spawnSeconds: Number(el<HTMLInputElement>('spawn-seconds').value), enabledBonuses: BONUS_KINDS.filter(kind => el<HTMLInputElement>(`bonus-${kind}`).checked) });
  persistPreferences(); populateSettings(); startMatch(currentRecipe()); toast('Une nouvelle bataille, à votre goût.'); el('game-shell').scrollIntoView({ behavior: preferences.reducedEffects ? 'instant' : 'smooth', block: 'start' });
});
el<HTMLSelectElement>('theme-select').addEventListener('change', event => { preferences.theme = (event.target as HTMLSelectElement).value as ThemeName; setAppearance(); persistPreferences(); });
el<HTMLInputElement>('volume').addEventListener('input', event => { preferences.volume = Number((event.target as HTMLInputElement).value) / 100; setAppearance(); });
el('volume').addEventListener('change', persistPreferences);
el<HTMLInputElement>('reduced-effects').addEventListener('change', event => { preferences.reducedEffects = (event.target as HTMLInputElement).checked; setAppearance(); persistPreferences(); });
el('reset-settings').addEventListener('click', () => { preferences = defaultPreferences(); persistPreferences(); populateSettings(); localize(); toast('Préférences réinitialisées. La partie en cours est conservée.'); });
el('share-button').addEventListener('click', () => { el<HTMLInputElement>('share-url').value = makeShareURL(state); copyMessage = ''; el('copy-status').textContent = ''; el<HTMLDialogElement>('share-dialog').showModal(); });
el('copy-link').addEventListener('click', async () => {
  const input = el<HTMLInputElement>('share-url');
  try { await navigator.clipboard.writeText(input.value); copyMessage = 'Lien copié. La bataille peut voyager.'; }
  catch { input.focus(); input.select(); copyMessage = 'Sélectionnez et copiez le lien ci-dessus.'; }
  el('copy-status').textContent = text(copyMessage);
});
el('capture-button').addEventListener('click', () => {
  const canvas = renderer.capture(state, preferences.theme, preferences.language);
  canvas.toBlob(blob => { if (!blob) { toast('La capture n’a pas pu être créée.'); return; } const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `latte-vs-roast-${state.seed}.png`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 5000); toast('Votre capture est prête.'); }, 'image/png');
});
window.addEventListener('hashchange', () => { const next = parseShare(location.hash); if (!next) return; if ('error' in next) toast(next.error, 8000); else startMatch(next.config, next.seed, true); });

// Lecture seule : utile au diagnostic et aux tests, sans exposer l’état mutable.
Object.defineProperty(window, '__LATTE_DIAGNOSTICS__', { value: () => ({ tick: state.tick, seed: state.seed, version: RULES_VERSION, config: structuredClone(state.config), counts: { ...state.counts }, winner: state.winner, paused: paused || backgroundPaused, balls: state.balls.length, effects: state.effects.map(e => e.kind), historyLength: records.length }), configurable: true });
if (shared && 'error' in shared) toast(shared.error, 8500);
else if (shared) toast('Partie partagée chargée. Même graine, mêmes règles.');
else if (!storageAvailable()) toast('Le stockage local est indisponible ; vous pouvez tout de même jouer.');
requestAnimationFrame(frame);
