import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from '../src/audio';

class Parameter {
  value = 1;
  setValueAtTime(value: number): void { this.value = value; }
  exponentialRampToValueAtTime(value: number): void { this.value = value; }
  setTargetAtTime(value: number): void { this.value = value; }
  cancelScheduledValues(): void { /* Mock clock: no scheduled automation. */ }
}
class Gain {
  gain = new Parameter();
  connect = vi.fn();
  disconnect = vi.fn();
}
class Oscillator {
  type = 'sine';
  frequency = new Parameter();
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
const fixture: { context?: FakeAudioContext } = {};
class FakeAudioContext {
  state = 'suspended';
  currentTime = 1;
  destination = {};
  allowResume = false;
  gains: Gain[] = [];
  oscillators: Oscillator[] = [];
  constructor() { fixture.context = this; }
  resume = vi.fn(async () => {
    if (!this.allowResume) throw new Error('User activation required');
    this.state = 'running';
  });
  createGain(): Gain { const gain = new Gain(); this.gains.push(gain); return gain; }
  createOscillator(): Oscillator { const oscillator = new Oscillator(); this.oscillators.push(oscillator); return oscillator; }
}
beforeEach(() => { fixture.context = undefined; vi.stubGlobal('AudioContext', FakeAudioContext); });
afterEach(() => vi.unstubAllGlobals());
const bounce = { type: 'bounce' as const, team: 'latte' as const, x: 0, y: 0 };

describe('son et restrictions de lecture automatique', () => {
  it('reste silencieux tant que le navigateur refuse, puis reprend après un geste autorisé', async () => {
    const audio = new GameAudio();
    audio.set(true, 0.3);
    expect(fixture.context).toBeUndefined();
    expect(await audio.unlock()).toBe(false);
    const context = fixture.context!;
    await Promise.resolve(); await Promise.resolve();
    audio.consume([bounce]);
    expect(context.oscillators).toHaveLength(0);
    context.allowResume = true;
    audio.unlock();
    await Promise.resolve();
    context.currentTime += 0.1;
    audio.consume([bounce]);
    expect(context.oscillators.length).toBeGreaterThan(0);
    expect(context.gains[0].gain.value).toBe(0.3);
  });

  it('coupe immédiatement le gain maître, y compris pendant une fanfare programmée', async () => {
    const audio = new GameAudio();
    audio.set(true, 0.4); await audio.unlock();
    const context = fixture.context!;
    context.allowResume = true; audio.unlock(); await Promise.resolve();
    audio.consume([{ ...bounce, type: 'victory' }]);
    expect(context.oscillators).toHaveLength(4);
    audio.set(false, 0.4);
    expect(context.gains[0].gain.value).toBe(0);
    audio.consume([{ ...bounce, type: 'bonus' }]);
    expect(context.oscillators).toHaveLength(4);
  });

  it('applique un volume nul immédiatement et tolère un navigateur sans Web Audio', async () => {
    const audio = new GameAudio();
    audio.set(true, 0.3); await audio.unlock();
    const context = fixture.context!;
    audio.set(true, 0);
    expect(context.gains[0].gain.value).toBe(0);
    vi.stubGlobal('AudioContext', undefined);
    expect(() => { const unsupported = new GameAudio(); unsupported.set(true, 0.3); unsupported.unlock(); unsupported.consume([bounce]); }).not.toThrow();
  });

  it('une collecte produit deux notes après le geste, jamais à volume nul', async () => {
    const audio = new GameAudio(); audio.set(true, 0.3);
    await audio.unlock(); const context = fixture.context!;
    context.allowResume = true;
    expect(await audio.unlock()).toBe(true);
    audio.consume([{ ...bounce, type: 'bonus' }]);
    expect(context.oscillators).toHaveLength(2);
    audio.set(true, 0);
    audio.consume([{ ...bounce, type: 'bonus' }]);
    expect(context.oscillators).toHaveLength(2);
  });

  it('reprend un contexte interrompu et coupe le son pendant l’arrière-plan', async () => {
    const audio = new GameAudio(); audio.set(true, 0.3); await audio.unlock();
    const context = fixture.context!; context.allowResume = true; await audio.unlock();
    audio.setBackground(true);
    expect(context.gains[0].gain.value).toBe(0);
    audio.consume([bounce]); expect(context.oscillators).toHaveLength(0);
    context.state = 'interrupted';
    audio.setBackground(false); await Promise.resolve();
    expect(context.state).toBe('running');
    expect(context.gains[0].gain.value).toBe(0.3);
    audio.consume([bounce]); expect(context.oscillators).toHaveLength(1);
  });

  it('recrée un contexte fermé et utilise le constructeur préfixé si nécessaire', async () => {
    const audio = new GameAudio(); audio.set(true, 0.3); await audio.unlock();
    const first = fixture.context!; first.state = 'closed';
    await audio.unlock(); expect(fixture.context).not.toBe(first);
    vi.stubGlobal('AudioContext', undefined); vi.stubGlobal('webkitAudioContext', FakeAudioContext);
    const legacy = new GameAudio(); legacy.set(true, 0.3);
    expect(legacy.supported).toBe(true); await legacy.unlock();
    fixture.context!.allowResume = true;
    expect(await legacy.unlock()).toBe(true);
  });
});
