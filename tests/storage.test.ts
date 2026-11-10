import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, defaultPreferences, RULES_VERSION } from '../src/config';
import { loadPreferences, loadRecords, makeShareURL, parseShare, savePreferences, saveRecords } from '../src/storage';
import type { MatchRecord } from '../src/types';

const preferenceKey = 'latte-vs-roast.preferences.v1';
const historyKey = 'latte-vs-roast.history.v1';
let data: Map<string, string>;
const encode = (value: unknown) => `#partie=${btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`;
const record = (id: number): MatchRecord => ({ id: String(id), date: '2026-11-09T12:00:00.000Z', seed: id, config: structuredClone(DEFAULT_CONFIG), version: RULES_VERSION, winner: 'roast', ticks: 1200, history: [{ tick: 0, latte: 0.5 }, { tick: 1200, latte: 0.09 }] });

beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } });
  vi.stubGlobal('window', { location: { href: 'https://matteo12sa.github.io/latte-vs-roast/?ancien=1#ancien' } });
});
afterEach(() => vi.unstubAllGlobals());

describe('préférences et historique', () => {
  it('démarre en anglais avec le son activé lorsque rien n’est enregistré', () => {
    expect(loadPreferences()).toMatchObject({ language: 'en', sound: true, volume: 0.3 });
  });

  it('migre les anciennes préférences françaises sans langue vers anglais et son actif', () => {
    data.set(preferenceKey, JSON.stringify({ theme: 'night', sound: false, volume: 0.6, profile: 'custom', customConfig: { ...DEFAULT_CONFIG, columns: 12, rows: 16 } }));
    expect(loadPreferences()).toMatchObject({ language: 'en', sound: true, theme: 'night', volume: 0.6, profile: 'custom', customConfig: { columns: 12, rows: 16 } });
  });

  it.each(['en', 'fr'] as const)('respecte le silence choisi explicitement dans la nouvelle version (%s)', language => {
    const preferences = { ...defaultPreferences(), language, sound: false };
    expect(savePreferences(preferences)).toBe(true);
    expect(loadPreferences()).toEqual(preferences);
  });

  it('remplace une langue inconnue et une valeur sonore invalide par les défauts sûrs', () => {
    data.set(preferenceKey, JSON.stringify({ language: 'xx', sound: 'false' }));
    expect(loadPreferences()).toMatchObject({ language: 'en', sound: true });
  });

  it('revient aux valeurs sûres lorsque les préférences sont corrompues', () => {
    data.set(preferenceKey, '{incomplet'); expect(loadPreferences()).toEqual(defaultPreferences());
    data.set(preferenceKey, JSON.stringify({ theme: '<script>', volume: 50, customConfig: { columns: 1000 } }));
    expect(loadPreferences()).toMatchObject({ theme: 'coffee', volume: 1, customConfig: { columns: 30 } });
  });

  it('conserve les choix enregistrés', () => {
    const preferences = { ...defaultPreferences(), theme: 'night' as const, sound: true, volume: 0.7, profile: 'custom' as const };
    expect(savePreferences(preferences)).toBe(true); expect(loadPreferences()).toEqual(preferences);
  });

  it('continue sans exception lorsque le navigateur refuse le stockage', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); } });
    expect(loadPreferences()).toEqual(defaultPreferences()); expect(loadRecords()).toEqual([]);
    expect(savePreferences(defaultPreferences())).toBe(false); expect(saveRecords([record(1)])).toBe(false);
  });

  it('limite le carnet aux cent dernières entrées fournies', () => {
    expect(saveRecords(Array.from({ length: 110 }, (_, index) => record(index)))).toBe(true);
    const records = loadRecords(); expect(records).toHaveLength(100); expect(records[0].id).toBe('0'); expect(records[99].id).toBe('99');
  });

  it('conserve cent résultats longs sans saturer le stockage avec des anciennes courbes', () => {
    const records = Array.from({ length: 100 }, (_, index) => ({ ...record(index), history: Array.from({ length: 1800 }, (_, tick) => ({ tick: tick * 120, latte: 0.51 })) }));
    expect(saveRecords(records)).toBe(true);
    expect(data.get(historyKey)!.length).toBeLessThan(200000);
    const loaded = loadRecords();
    expect(loaded).toHaveLength(100);
    expect(loaded[0].history).toHaveLength(1800);
    expect(loaded[1].history).toEqual([]);
    expect(loaded[99].seed).toBe(records[99].seed);
  });

  it('ignore les entrées incompatibles et les mesures invalides', () => {
    const valid = record(1);
    data.set(historyKey, JSON.stringify([{ ...record(2), version: 'ancien' }, { ...record(3), ticks: -1 }, { ...valid, history: [...valid.history, { tick: 50, latte: 4 }] }]));
    const records = loadRecords(); expect(records).toHaveLength(1); expect(records[0].history).toEqual(valid.history);
  });

  it.each(['1.0.0', '1.0.1'])('garde les résultats %s même après évolution des règles', version => {
    const legacy = { ...record(42), version };
    data.set(historyKey, JSON.stringify([legacy, record(43)]));
    const records = loadRecords();
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ id: '42', seed: 42, version, winner: 'roast' });
  });
});

describe('liens de partage', () => {
  it('restitue la graine et les paramètres, sans conserver les anciennes recherches', () => {
    const url = new URL(makeShareURL({ seed: 4294967295, config: DEFAULT_CONFIG }));
    expect(url.pathname).toBe('/latte-vs-roast/'); expect(url.search).toBe('');
    expect(parseShare(url.hash)).toEqual({ seed: 4294967295, config: DEFAULT_CONFIG });
  });

  it('refuse explicitement une version inconnue', () => {
    expect(parseShare(encode({ v: '99.0.0', s: 123, c: DEFAULT_CONFIG }))).toEqual({ error: expect.stringContaining('autre version des règles') });
  });

  it.each([
    { v: RULES_VERSION, s: -1, c: DEFAULT_CONFIG },
    { v: RULES_VERSION, s: 1.2, c: DEFAULT_CONFIG },
    { v: RULES_VERSION, s: 4294967296, c: DEFAULT_CONFIG },
    { v: RULES_VERSION, s: 1, c: { ...DEFAULT_CONFIG, columns: 31 } },
    { v: RULES_VERSION, s: 1, c: { ...DEFAULT_CONFIG, enabledBonuses: ['nitro', 'nitro'] } },
    { v: RULES_VERSION, s: 1, c: { ...DEFAULT_CONFIG, enabledBonuses: ['inconnu'] } },
  ])('refuse les paramètres invalides sans correction silencieuse (%j)', value => {
    expect(parseShare(encode(value))).toEqual({ error: expect.stringContaining('incomplet ou invalide') });
  });

  it('ignore les ancres ordinaires et rejette les données illisibles ou excessives', () => {
    expect(parseShare('')).toBeNull(); expect(parseShare('#reglages')).toBeNull();
    expect(parseShare('#partie=!!!')).toEqual({ error: expect.any(String) });
    expect(parseShare(`#partie=${'a'.repeat(5001)}`)).toEqual({ error: expect.any(String) });
  });
});
