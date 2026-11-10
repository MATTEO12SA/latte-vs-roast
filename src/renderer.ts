import { BASE_RADIUS, RULES_VERSION, TICK_RATE, formatTime } from './config';
import { bonusInfo, localizedTeamName, localeFor, t } from './i18n';
import { THEMES } from './themes';
import type { Palette } from './themes';
import type { Ball, BonusKind, Language, MatchEvent, MatchState, Team, ThemeName } from './types';

export interface RenderOptions {
  theme: ThemeName;
  reducedEffects: boolean;
  /** Elapsed wall-clock seconds; use zero while the game is paused. */
  delta: number;
}

interface TrailPoint { x: number; y: number; radius: number; }
interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; radius: number; team: Team; ring: boolean; }

const MAX_PARTICLES = 300;
const MAX_TRAIL = 30;
const TAU = Math.PI * 2;

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, radius), 0, TAU);
  ctx.fill();
}

/** Vector icons stay crisp on small screens and in exported screenshots. */
function bonusIcon(ctx: CanvasRenderingContext2D, kind: BonusKind, x: number, y: number, size: number, ink: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 0.08;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (kind) {
    case 'ghost':
      ctx.moveTo(-0.28, 0.32); ctx.lineTo(-0.28, -0.03);
      ctx.bezierCurveTo(-0.28, -0.4, 0.28, -0.4, 0.28, -0.03);
      ctx.lineTo(0.28, 0.32); ctx.lineTo(0.14, 0.22); ctx.lineTo(0, 0.32);
      ctx.lineTo(-0.14, 0.22); ctx.closePath(); ctx.stroke();
      circle(ctx, -0.1, -0.04, 0.035); circle(ctx, 0.1, -0.04, 0.035);
      break;
    case 'blackHole':
      ctx.arc(0, 0, 0.32, 0.25, TAU - 0.1); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 0.19, 2, TAU + 1.5); ctx.stroke();
      circle(ctx, 0, 0, 0.075);
      break;
    case 'tidalWave':
      for (const offset of [-0.24, 0, 0.24]) {
        ctx.moveTo(-0.35, offset + 0.05);
        ctx.bezierCurveTo(-0.15, offset + 0.3, 0.1, offset - 0.3, 0.35, offset - 0.05);
      }
      ctx.stroke();
      break;
    case 'speed':
      ctx.moveTo(-0.28, 0.28); ctx.lineTo(0.27, -0.27);
      ctx.moveTo(-0.05, -0.28); ctx.lineTo(0.28, -0.28); ctx.lineTo(0.28, 0.05); ctx.stroke();
      break;
    case 'nitro':
      ctx.moveTo(0.1, -0.4); ctx.lineTo(-0.3, 0.06); ctx.lineTo(-0.02, 0.06);
      ctx.lineTo(-0.12, 0.4); ctx.lineTo(0.31, -0.08); ctx.lineTo(0.04, -0.08);
      ctx.closePath(); ctx.fill();
      break;
    case 'wreckingBall':
      ctx.moveTo(0.17, -0.37); ctx.lineTo(0.04, -0.08); ctx.stroke();
      circle(ctx, -0.04, 0.16, 0.22);
      ctx.beginPath(); ctx.arc(0.16, -0.29, 0.1, 0, TAU); ctx.stroke();
      break;
    case 'colossus':
      circle(ctx, 0, 0, 0.22);
      ctx.moveTo(-0.18, -0.36); ctx.lineTo(-0.36, -0.36); ctx.lineTo(-0.36, -0.18);
      ctx.moveTo(0.18, -0.36); ctx.lineTo(0.36, -0.36); ctx.lineTo(0.36, -0.18);
      ctx.moveTo(-0.18, 0.36); ctx.lineTo(-0.36, 0.36); ctx.lineTo(-0.36, 0.18);
      ctx.moveTo(0.18, 0.36); ctx.lineTo(0.36, 0.36); ctx.lineTo(0.36, 0.18); ctx.stroke();
      break;
    case 'infiltrator':
      ctx.moveTo(0, -0.37); ctx.lineTo(0.3, 0); ctx.lineTo(0, 0.37);
      ctx.lineTo(-0.3, 0); ctx.closePath(); ctx.stroke();
      circle(ctx, 0, 0, 0.07);
      break;
    case 'trinity':
      circle(ctx, 0, -0.21, 0.15); circle(ctx, -0.23, 0.2, 0.15); circle(ctx, 0.23, 0.2, 0.15);
      break;
    case 'wormhole':
      ctx.ellipse(-0.23, 0, 0.13, 0.31, -0.18, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0.23, 0, 0.13, 0.31, -0.18, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.18, 0); ctx.lineTo(0.18, 0); ctx.stroke();
      break;
    case 'turret':
      ctx.arc(0, 0, 0.25, 0, TAU);
      ctx.moveTo(-0.38, 0); ctx.lineTo(0.38, 0);
      ctx.moveTo(0, -0.38); ctx.lineTo(0, 0.38); ctx.stroke();
      break;
  }
  ctx.restore();
}

/** Drawing is deliberately independent from the simulation and its random stream. */
export class GameRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly terrain: HTMLCanvasElement;
  private readonly terrainCtx: CanvasRenderingContext2D;
  private terrainRevision = -1;
  private terrainTheme: ThemeName | null = null;
  private terrainState: MatchState | null = null;
  private readonly trails = new Map<number, TrailPoint[]>();
  private particles: Particle[] = [];
  private lastTick = -1;
  private lastState: MatchState | null = null;
  private reduced = false;
  private visualRandom = 0x5f3759df;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Votre navigateur ne permet pas d’afficher le terrain.');
    this.ctx = ctx;
    this.terrain = document.createElement('canvas');
    const terrainCtx = this.terrain.getContext('2d', { alpha: false });
    if (!terrainCtx) throw new Error('Le dessin du terrain est indisponible.');
    this.terrainCtx = terrainCtx;
  }

  private random(): number {
    let n = this.visualRandom;
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    this.visualRandom = n >>> 0;
    return this.visualRandom / 4294967296;
  }

  consumeEvents(events: readonly MatchEvent[]): void {
    if (this.reduced) return;
    for (const event of events) {
      if (event.type === 'expire') continue;
      const burst = event.type === 'bonus' || event.type === 'teleport' || event.type === 'victory';
      const amount = burst ? 16 : event.type === 'capture' ? 3 : 1;
      for (let i = 0; i < amount && this.particles.length < MAX_PARTICLES; i++) {
        const angle = this.random() * TAU;
        const speed = (burst ? 2 : 0.5) + this.random() * (burst ? 4 : 1.3);
        this.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          age: 0, life: burst ? 0.7 : 0.32, radius: burst ? 0.055 : 0.035, team: event.team, ring: false });
      }
      if (burst && this.particles.length < MAX_PARTICLES) {
        this.particles.push({ x: event.x, y: event.y, vx: 0, vy: 0, age: 0, life: 0.65, radius: 0.2, team: event.team, ring: true });
      }
    }
  }

  renderMatch(state: MatchState, options: RenderOptions): void {
    if (this.lastState !== state || state.tick < this.lastTick) {
      this.trails.clear();
      this.lastTick = -1;
      this.lastState = state;
    }
    this.reduced = options.reducedEffects;
    const delta = Math.min(0.1, Math.max(0, options.delta));
    if (this.reduced) { this.particles = []; this.trails.clear(); }
    else {
      this.updateParticles(delta);
      this.updateTrails(state);
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = this.canvas.clientWidth || 540;
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(width * state.config.rows / state.config.columns));
    this.canvas.style.aspectRatio = `${state.config.columns} / ${state.config.rows}`;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
    this.ctx.setTransform(width / state.config.columns, 0, 0, height / state.config.rows, 0, 0);
    this.drawScene(this.ctx, state, options.theme, !this.reduced);
    this.lastTick = state.tick;
  }

  private updateParticles(delta: number): void {
    for (const particle of this.particles) {
      particle.age += delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      const drag = Math.exp(-4 * delta);
      particle.vx *= drag; particle.vy *= drag;
    }
    this.particles = this.particles.filter(p => p.age < p.life);
  }

  private updateTrails(state: MatchState): void {
    const ids = new Set(state.balls.map(ball => ball.id));
    for (const id of this.trails.keys()) if (!ids.has(id)) this.trails.delete(id);
    if (state.tick === this.lastTick) return;
    for (const ball of state.balls) {
      const trail = this.trails.get(ball.id) ?? [];
      const previous = trail.at(-1);
      // A teleport must not draw a line across the entire arena.
      if (previous && Math.hypot(previous.x - ball.x, previous.y - ball.y) > 3) trail.length = 0;
      trail.push({ x: ball.x, y: ball.y, radius: ball.radius });
      if (trail.length > MAX_TRAIL) trail.splice(0, trail.length - MAX_TRAIL);
      this.trails.set(ball.id, trail);
    }
  }

  private cacheTerrain(state: MatchState, theme: ThemeName): void {
    if (this.terrainState === state && this.terrainRevision === state.revision && this.terrainTheme === theme) return;
    const { columns, rows } = state.config;
    if (this.terrain.width !== columns || this.terrain.height !== rows) {
      this.terrain.width = columns; this.terrain.height = rows;
    }
    const palette = THEMES[theme];
    this.terrainCtx.fillStyle = palette.coffee;
    this.terrainCtx.fillRect(0, 0, columns, rows);
    this.terrainCtx.fillStyle = palette.cream;
    for (let y = 0; y < rows; y++) {
      let start = -1;
      for (let x = 0; x <= columns; x++) {
        const isCream = x < columns && state.grid[y * columns + x] === 0;
        if (isCream && start < 0) start = x;
        else if (!isCream && start >= 0) { this.terrainCtx.fillRect(start, y, x - start, 1); start = -1; }
      }
    }
    this.terrainRevision = state.revision; this.terrainTheme = theme; this.terrainState = state;
  }

  private drawScene(ctx: CanvasRenderingContext2D, state: MatchState, theme: ThemeName, effects: boolean): void {
    const palette = THEMES[theme];
    const { columns, rows } = state.config;
    this.cacheTerrain(state, theme);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, columns, rows); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terrain, 0, 0, columns, rows);
    ctx.imageSmoothingEnabled = true;
    const clock = state.tick / TICK_RATE;

    for (const vortex of state.vortexes) {
      const color = vortex.team === 'latte' ? palette.latteBall : palette.roastBall;
      ctx.save(); ctx.translate(vortex.x, vortex.y);
      ctx.strokeStyle = color; ctx.fillStyle = color;
      ctx.globalAlpha = 0.11;
      ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.arc(0, 0, 1.05, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.8;
      ctx.rotate(effects ? clock * 2 : 0);
      for (let i = 0; i < 3; i++) {
        ctx.rotate(TAU / 3);
        ctx.beginPath(); ctx.ellipse(0.08, 0, 0.65, 0.42, 0, 0.3, 1.8); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      circle(ctx, 0, 0, 0.25);
      if (effects) {
        for (let i = 0; i < 13; i++) {
          const angle = i * 2.4 + clock * 0.7;
          const distance = 0.4 + (i % 5) * 0.085;
          ctx.globalAlpha = 0.25 + (i % 3) * 0.18;
          circle(ctx, Math.cos(angle) * distance, Math.sin(angle) * distance, 0.025);
        }
      }
      ctx.restore();
    }

    for (const pickup of state.pickups) {
      const remaining = (pickup.expiresAt - state.tick) / TICK_RATE;
      ctx.save();
      ctx.globalAlpha = remaining < 2 && effects ? 0.5 + 0.5 * Math.abs(Math.sin(clock * 5)) : 1;
      ctx.fillStyle = palette.pickup;
      ctx.fillRect(pickup.x - 0.27, pickup.y - 0.27, 0.54, 0.54);
      bonusIcon(ctx, pickup.kind, pickup.x, pickup.y, 0.46, palette.pickupInk);
      ctx.restore();
    }

    for (const turret of state.turrets) {
      const color = turret.team === 'latte' ? palette.latteBall : palette.roastBall;
      ctx.save(); ctx.translate(turret.x, turret.y);
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 0.07;
      ctx.beginPath(); ctx.arc(0, 0, 0.28, 0, TAU); ctx.stroke();
      circle(ctx, 0, 0, 0.11);
      let nearestX = turret.team === 'latte' ? columns : 0;
      let nearestY = turret.y;
      let distance = Infinity;
      const enemy = turret.team === 'latte' ? 1 : 0;
      for (let i = 0; i < state.grid.length; i++) {
        if (state.grid[i] !== enemy) continue;
        const x = i % columns + 0.5; const y = Math.floor(i / columns) + 0.5;
        const d = (x - turret.x) ** 2 + (y - turret.y) ** 2;
        if (d < distance) { distance = d; nearestX = x; nearestY = y; }
      }
      ctx.rotate(Math.atan2(nearestY - turret.y, nearestX - turret.x));
      ctx.fillRect(0.08, -0.07, 0.35, 0.14);
      ctx.restore();
    }

    for (const projectile of state.projectiles) {
      ctx.fillStyle = projectile.team === 'latte' ? palette.latteBall : palette.roastBall;
      circle(ctx, projectile.x, projectile.y, 0.09);
    }

    for (const ball of state.balls) {
      const nitro = state.effects.some(effect => effect.team === ball.team && effect.kind === 'nitro');
      if (effects && (nitro || ball.radius > BASE_RADIUS * 1.5)) this.drawTrail(ctx, ball, palette);
      const color = ball.team === 'latte' ? palette.latteBall : palette.roastBall;
      if (nitro && effects) {
        const glow = ctx.createRadialGradient(ball.x, ball.y, ball.radius * 0.35, ball.x, ball.y, ball.radius * 1.75);
        glow.addColorStop(0, `${color}66`); glow.addColorStop(1, `${color}00`);
        ctx.fillStyle = glow;
        circle(ctx, ball.x, ball.y, ball.radius * 1.75);
      }
      ctx.fillStyle = color;
      circle(ctx, ball.x, ball.y, ball.radius);
      if (ball.role === 'infiltrator') {
        ctx.strokeStyle = color; ctx.lineWidth = 0.035;
        ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius + 0.11, 0, TAU); ctx.stroke();
      }
    }

    if (effects) {
      for (const particle of this.particles) {
        const progress = particle.age / particle.life;
        ctx.globalAlpha = (1 - progress) * 0.8;
        const color = particle.team === 'latte' ? palette.latteBall : palette.roastBall;
        if (particle.ring) {
          ctx.strokeStyle = color; ctx.lineWidth = 0.045 * (1 - progress);
          ctx.beginPath(); ctx.arc(particle.x, particle.y, 0.2 + progress * 1.2, 0, TAU); ctx.stroke();
        } else {
          ctx.fillStyle = color;
          circle(ctx, particle.x, particle.y, particle.radius * (1 - progress * 0.5));
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private drawTrail(ctx: CanvasRenderingContext2D, ball: Ball, palette: Palette): void {
    const points = this.trails.get(ball.id);
    if (!points || points.length < 2) return;
    ctx.save();
    ctx.fillStyle = ball.team === 'latte' ? palette.latteBall : palette.roastBall;
    for (let i = 0; i < points.length - 1; i++) {
      const progress = (i + 1) / points.length;
      const point = points[i];
      ctx.globalAlpha = progress * progress * 0.33;
      circle(ctx, point.x, point.y, point.radius * (0.2 + progress * 0.8));
    }
    ctx.restore();
  }

  /** Create an independent, complete portrait card; does not mutate game state. */
  capture(state: MatchState, theme: ThemeName, language: Language = 'en'): HTMLCanvasElement {
    const output = document.createElement('canvas');
    const palette = THEMES[theme];
    const width = 800;
    const margin = 48;
    const boardWidth = width - margin * 2;
    const scale = boardWidth / state.config.columns;
    const boardHeight = scale * state.config.rows;
    const visibleEffects = state.effects.filter(effect => effect.expiresAt > state.tick);
    const bannerHeight = 25;
    const header = 156 + visibleEffects.length * bannerHeight;
    output.width = width;
    output.height = Math.ceil(header + boardHeight + 168);
    const ctx = output.getContext('2d');
    if (!ctx) throw new Error('La capture est indisponible sur ce navigateur.');

    const background = ctx.createLinearGradient(0, 0, 0, output.height);
    background.addColorStop(0, palette.bgTop); background.addColorStop(1, palette.bgBottom);
    ctx.fillStyle = background; ctx.fillRect(0, 0, width, output.height);
    ctx.fillStyle = palette.muted; ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(t('UNE BATAILLE. DEUX CARACTÈRES.', language), margin, 40);
    ctx.fillStyle = palette.ink; ctx.font = '600 39px Georgia, serif';
    ctx.fillText(t('Crème contre Café', language), margin, 88);
    ctx.fillStyle = palette.muted; ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`${t('Partie', language)} ${state.seed} · ${formatTime(state.tick)}`, margin, 117);

    let y = 138;
    for (const effect of visibleEffects) {
      const cream = effect.team === 'latte';
      ctx.fillStyle = cream ? palette.cream : palette.coffee;
      ctx.fillRect(margin, y, boardWidth, bannerHeight - 3);
      ctx.fillStyle = cream ? palette.latteBall : palette.roastBall;
      ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${bonusInfo(effect.kind, language).name.toLocaleUpperCase(localeFor(language))} · ${localizedTeamName(effect.team, language).toLocaleUpperCase(localeFor(language))}`, width / 2, y + 15);
      y += bannerHeight;
    }
    ctx.textAlign = 'left';
    ctx.save(); ctx.translate(margin, header); ctx.scale(scale, scale);
    // Reuse the visible trails and particles, without advancing either their
    // clocks or the simulation. The exported frame matches the current board.
    this.drawScene(ctx, state, theme, !this.reduced);
    ctx.restore();

    const boardBottom = header + boardHeight;
    const total = state.grid.length;
    const trackX = margin + 70;
    const trackWidth = boardWidth - 70;
    for (const [index, team] of (['latte', 'roast'] as const).entries()) {
      const lineY = boardBottom + 23 + index * 21;
      const fraction = state.counts[team] / total;
      ctx.font = '700 10px system-ui, sans-serif'; ctx.fillStyle = palette.ink;
      ctx.fillText(localizedTeamName(team, language).toLocaleUpperCase(localeFor(language)), margin, lineY + 10);
      ctx.fillStyle = '#ffffff18'; ctx.fillRect(trackX, lineY, trackWidth, 13);
      ctx.fillStyle = team === 'latte' ? palette.cream : palette.roastBall;
      ctx.fillRect(trackX, lineY, trackWidth * fraction, 13);
      ctx.fillStyle = palette.line;
      ctx.fillRect(trackX + trackWidth * state.config.winThreshold, lineY - 1, 1, 15);
    }

    if (state.winner) {
      ctx.fillStyle = '#080503a8'; ctx.fillRect(margin, header, boardWidth, boardHeight);
      const cardWidth = 340; const cardHeight = 158;
      const cardX = (width - cardWidth) / 2; const cardY = header + (boardHeight - cardHeight) / 2;
      const cream = state.winner === 'latte';
      ctx.fillStyle = cream ? palette.cream : palette.coffee;
      ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
      ctx.fillStyle = cream ? palette.latteBall : palette.roastBall;
      ctx.beginPath();
      const crownX = width / 2;
      ctx.moveTo(crownX - 15, cardY + 30); ctx.lineTo(crownX - 9, cardY + 40);
      ctx.lineTo(crownX, cardY + 29); ctx.lineTo(crownX + 9, cardY + 40);
      ctx.lineTo(crownX + 15, cardY + 30); ctx.lineTo(crownX + 12, cardY + 51);
      ctx.lineTo(crownX - 12, cardY + 51); ctx.closePath(); ctx.fill();
      ctx.textAlign = 'center'; ctx.font = '800 22px system-ui, sans-serif';
      ctx.fillText(`${localizedTeamName(state.winner, language).toLocaleUpperCase(localeFor(language))} ${t('DOMINE !', language)}`, width / 2, cardY + 90);
      ctx.font = '13px system-ui, sans-serif'; ctx.fillText(`${t('Victoire en', language)} ${formatTime(state.tick)}`, width / 2, cardY + 119);
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = palette.muted; ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Latte vs Roast', margin, output.height - 47);
    ctx.textAlign = 'right'; ctx.fillText(`${t('Règles', language)} ${RULES_VERSION}`, width - margin, output.height - 47);
    ctx.textAlign = 'left'; ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('matteo12sa.github.io/latte-vs-roast', margin, output.height - 27);
    return output;
  }

  reset(): void {
    this.trails.clear(); this.particles = []; this.lastTick = -1; this.lastState = null;
    this.terrainRevision = -1; this.terrainState = null; this.visualRandom = 0x5f3759df;
  }

  dispose(): void {
    this.reset();
    this.terrain.width = 1; this.terrain.height = 1;
  }
}
