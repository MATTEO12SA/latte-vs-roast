import type { MatchEvent } from './types';
export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = false;
  private volume = 0.3;
  private lastBounce = -1;
  private background = false;
  private interactionRequested = false;
  constructor(private readonly onStateChange: () => void = () => undefined) {}
  get isRunning(): boolean { return this.context?.state === 'running'; }
  get hasInteraction(): boolean { return this.interactionRequested; }
  get supported(): boolean { return typeof globalThis.AudioContext === 'function' || typeof (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext === 'function'; }
  set(enabled: boolean, volume: number): void {
    this.enabled = enabled; this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.3));
    // Create the context inside a real gesture, never speculatively on load.
    if (this.master && this.context) this.master.gain.setValueAtTime(enabled && !this.background ? this.volume : 0, this.context.currentTime);
    this.onStateChange();
  }
  async unlock(): Promise<boolean> {
    if (!this.enabled || this.background) return false;
    this.interactionRequested = true; this.onStateChange();
    if (!this.supported) return false;
    try {
      if (!this.context || this.context.state === 'closed') {
        const Context = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
        this.context = new Context();
        this.master = this.context.createGain(); this.master.connect(this.context.destination);
        this.master.gain.setValueAtTime(this.volume, this.context.currentTime);
        this.context.onstatechange = this.onStateChange;
        this.lastBounce = -1;
      }
      if (this.context.state !== 'running') await this.context.resume();
      this.onStateChange();
      return this.enabled && !this.background && this.isRunning;
    } catch { this.onStateChange(); return false; }
  }
  setBackground(hidden: boolean): void {
    this.background = hidden;
    this.set(this.enabled, this.volume);
    if (!hidden && this.context) void this.unlock();
  }
  private tone(frequency: number, duration: number, delay = 0, gain = 0.15): void {
    const context = this.context;
    if (!this.enabled || this.background || !context || !this.master || context.state !== 'running' || this.volume === 0) return;
    const oscillator = context.createOscillator(), envelope = context.createGain();
    const at = context.currentTime + delay;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, at); oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.7, at + duration);
    envelope.gain.setValueAtTime(0.0001, at); envelope.gain.exponentialRampToValueAtTime(gain, at + 0.005); envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope); envelope.connect(this.master); oscillator.start(at); oscillator.stop(at + duration + 0.01); oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  consume(events: MatchEvent[]): void {
    if (!this.enabled || this.background || !this.isRunning || this.volume === 0) return;
    const now = this.context?.currentTime ?? 0;
    for (const event of events) {
      if (event.type === 'bonus') { this.tone(540, 0.12, 0, 0.15); this.tone(810, 0.2, 0.08, 0.1); }
      else if (event.type === 'victory') [0, 0.12, 0.24, 0.38].forEach((delay, i) => this.tone([392, 494, 587, 784][i], 0.35, delay, 0.16));
      else if (event.type === 'bounce' && now - this.lastBounce > 0.065) { this.tone(event.team === 'latte' ? 420 : 330, 0.065, 0, 0.12); this.lastBounce = now; }
    }
  }
}
