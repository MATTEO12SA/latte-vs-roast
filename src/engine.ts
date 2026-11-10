import { BASE_RADIUS, BONUS_INFO, DEFAULT_CONFIG, MAX_BALLS, TICK_RATE, normalizeConfig } from './config';
import type { Ball, BonusKind, Effect, MatchConfig, MatchEvent, MatchState, Team } from './types';
import { circleOverlapsCell, sweepPointCircle, sweepCircleCell } from './physics';
import type { Hit } from './physics';

const DT = 1 / TICK_RATE;
const EPS = 1e-7;
const MAX_EVENTS = 512;
const teams: Team[] = ['latte', 'roast'];
const valueOf = (team: Team) => team === 'latte' ? 0 : 1;
const other = (team: Team): Team => team === 'latte' ? 'roast' : 'latte';
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Mulberry32. Simulation is the sole consumer of this stream. */
function random(state: MatchState): number {
  state.rng = (state.rng + 0x6D2B79F5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function emit(state: MatchState, event: MatchEvent): void {
  if (state.events.length < MAX_EVENTS) state.events.push(event);
  else if (event.type !== 'capture' && event.type !== 'bounce') {
    state.events.splice(0, 1);
    state.events.push(event);
  }
}

export function captureCell(state: MatchState, col: number, row: number, team: Team): boolean {
  if (state.winner) return false;
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || col >= state.config.columns || row < 0 || row >= state.config.rows) return false;
  const index = row * state.config.columns + col;
  const owner = valueOf(team);
  if (state.grid[index] === owner) return false;
  state.grid[index] = owner;
  state.counts[team]++;
  state.counts[other(team)]--;
  state.revision++;
  emit(state, { type: 'capture', team, x: col + 0.5, y: row + 0.5, count: 1 });
  // A fully eliminated camp must not regain a tile from an embedded ball or
  // an already-flying projectile later in this tick. Other thresholds are
  // still evaluated once the tick is complete.
  if (state.counts[other(team)] === 0) {
    state.winner = team;
    emit(state, { type: 'victory', team, x: state.config.columns / 2, y: state.config.rows / 2 });
  }
  return true;
}

function ownedAt(state: MatchState, x: number, y: number, team: Team): boolean {
  const col = Math.floor(x), row = Math.floor(y);
  return col >= 0 && row >= 0 && col < state.config.columns && row < state.config.rows && state.grid[row * state.config.columns + col] === valueOf(team);
}

function overlappingCells(state: MatchState, x: number, y: number, radius: number, callback: (col: number, row: number) => void): void {
  const minX = Math.max(0, Math.floor(x - radius)), maxX = Math.min(state.config.columns - 1, Math.floor(x + radius));
  const minY = Math.max(0, Math.floor(y - radius)), maxY = Math.min(state.config.rows - 1, Math.floor(y + radius));
  for (let row = minY; row <= maxY; row++) for (let col = minX; col <= maxX; col++) {
    if (circleOverlapsCell(x, y, radius, col, row)) callback(col, row);
  }
}

function fits(state: MatchState, x: number, y: number, radius: number, team: Team): boolean {
  if (x < radius || y < radius || x > state.config.columns - radius || y > state.config.rows - radius) return false;
  let valid = true;
  overlappingCells(state, x, y, radius, (col, row) => {
    if (state.grid[row * state.config.columns + col] !== valueOf(team)) valid = false;
  });
  return valid;
}

/** Find a legal center deterministically, never spin trying random positions. */
function findPosition(state: MatchState, team: Team, radius: number, fromX: number, fromY: number, farthest = false): { x: number; y: number } | null {
  let selected: { x: number; y: number } | null = null;
  let best = farthest ? -Infinity : Infinity;
  for (let row = 0; row < state.config.rows; row++) for (let col = 0; col < state.config.columns; col++) {
    if (state.grid[row * state.config.columns + col] !== valueOf(team)) continue;
    const x = col + 0.5, y = row + 0.5;
    if (!fits(state, x, y, radius, team)) continue;
    const distance = (x - fromX) ** 2 + (y - fromY) ** 2;
    if (farthest ? distance > best : distance < best) { best = distance; selected = { x, y }; }
  }
  return selected;
}

function attributes(state: MatchState, team: Team): { radius: number; speed: number; ghost: boolean; wrecking: boolean } {
  const active = state.effects.filter(e => e.team === team && e.expiresAt > state.tick);
  const ghost = active.some(e => e.kind === 'ghost');
  const colossus = Math.min(2, active.filter(e => e.kind === 'colossus').length);
  const nitro = Math.min(2, active.filter(e => e.kind === 'nitro').length);
  return {
    radius: BASE_RADIUS * (ghost ? 0.4 : colossus === 2 ? 5 : colossus === 1 ? 2.5 : 1),
    speed: Math.min(32, state.config.baseSpeed * (1 + nitro) * (active.some(e => e.kind === 'speed') ? 1.33 : 1)),
    ghost,
    wrecking: active.some(e => e.kind === 'wreckingBall')
  };
}

function setSpeed(ball: Ball, speed: number): void {
  const length = Math.hypot(ball.vx, ball.vy);
  if (length > EPS && Number.isFinite(length)) { ball.vx = ball.vx / length * speed; ball.vy = ball.vy / length * speed; }
  else { ball.vx = speed * 0.8; ball.vy = speed * 0.6; }
}

function ensurePosition(state: MatchState, ball: Ball, ghost: boolean): void {
  ball.x = clamp(Number.isFinite(ball.x) ? ball.x : state.config.columns / 2, ball.radius + EPS, state.config.columns - ball.radius - EPS);
  ball.y = clamp(Number.isFinite(ball.y) ? ball.y : state.config.rows / 2, ball.radius + EPS, state.config.rows - ball.radius - EPS);
  if (ghost || fits(state, ball.x, ball.y, ball.radius, ball.team)) return;
  const position = findPosition(state, ball.team, ball.radius, ball.x, ball.y);
  if (position) { ball.x = position.x; ball.y = position.y; }
  else {
    // An enlarged ball may have no room on a tiny remaining island. It creates
    // only the clearance it occupies, rather than becoming embedded forever.
    overlappingCells(state, ball.x, ball.y, ball.radius + EPS, (col, row) => captureCell(state, col, row, ball.team));
  }
}

function syncBalls(state: MatchState, team?: Team): void {
  if (state.winner) return;
  for (const ball of state.balls) {
    if (team && ball.team !== team) continue;
    const attr = attributes(state, ball.team);
    const changed = Math.abs(ball.radius - attr.radius) > EPS;
    ball.radius = attr.radius;
    setSpeed(ball, attr.speed);
    if (changed || (!attr.ghost && !ownedAt(state, ball.x, ball.y, ball.team))) ensurePosition(state, ball, attr.ghost);
  }
}

function newBall(state: MatchState, team: Team, x: number, y: number, role: Ball['role'], duration: number | null): Ball {
  const angle = (0.12 + random(state) * 0.28) * Math.PI + (random(state) < 0.5 ? Math.PI : 0);
  const ball: Ball = { id: state.nextId++, team, x, y, vx: Math.cos(angle) * state.config.baseSpeed, vy: Math.sin(angle) * state.config.baseSpeed, radius: BASE_RADIUS, role, expiresAt: duration === null ? null : state.tick + duration * TICK_RATE, holeCooldownUntil: 0, capturedBy: null, capturedUntil: 0 };
  state.balls.push(ball);
  return ball;
}

export function createMatch(config: MatchConfig = DEFAULT_CONFIG, seed = 1): MatchState {
  const clean = normalizeConfig(config);
  const safeSeed = Number.isFinite(seed) ? seed >>> 0 : 1;
  const total = clean.columns * clean.rows;
  const state: MatchState = {
    config: clean, seed: safeSeed, rng: safeSeed, tick: 0, nextId: 1,
    grid: new Uint8Array(total), counts: { latte: total / 2, roast: total / 2 },
    balls: [], pickups: [], effects: [], vortexes: [], turrets: [], projectiles: [],
    winner: null, events: [], history: [{ tick: 0, latte: 0.5 }],
    nextSpawnAt: Math.round(clean.spawnSeconds * TICK_RATE), revision: 0
  };
  for (let row = 0; row < clean.rows; row++) for (let col = clean.columns / 2; col < clean.columns; col++) state.grid[row * clean.columns + col] = 1;
  newBall(state, 'latte', clean.columns * 0.34, clean.rows * 0.56, 'original', null);
  newBall(state, 'roast', clean.columns * 0.65, clean.rows * 0.445, 'original', null);
  return state;
}

function addEffect(state: MatchState, kind: BonusKind, team: Team, seconds = BONUS_INFO[kind].seconds): Effect {
  const matching = state.effects.filter(e => e.kind === kind && e.team === team && e.expiresAt > state.tick);
  const expiresAt = state.tick + Math.round(seconds * TICK_RATE);
  if (kind === 'nitro' || kind === 'colossus') {
    if (matching.length >= 2) {
      matching.sort((a, b) => a.expiresAt - b.expiresAt || a.id - b.id);
      matching[0].startedAt = state.tick;
      matching[0].expiresAt = expiresAt;
      return matching[0];
    }
  } else if (kind !== 'trinity' && matching.length) {
    matching[0].startedAt = state.tick;
    matching[0].expiresAt = expiresAt;
    return matching[0];
  }
  const effect: Effect = { id: state.nextId++, team, kind, startedAt: state.tick, expiresAt };
  state.effects.push(effect);
  return effect;
}

export function activateBonus(state: MatchState, kind: BonusKind, team: Team, ballId?: number): void {
  if (state.winner) return;
  const source = state.balls.find(b => b.id === ballId && b.team === team) ?? state.balls.find(b => b.team === team);
  if (!source) return;
  emit(state, { type: 'bonus', kind, team, x: source.x, y: source.y });
  if (kind === 'tidalWave') {
    for (let row = 0; row < state.config.rows; row++) for (let col = team === 'latte' ? 0 : state.config.columns / 2; col < (team === 'latte' ? state.config.columns / 2 : state.config.columns); col++) captureCell(state, col, row, team);
    addEffect(state, kind, team);
  } else if (kind === 'blackHole') {
    // Target a nearby opponent rather than trapping the collecting camp.
    let x = source.x, y = source.y, nearest = Infinity;
    for (const enemy of state.balls) {
      if (enemy.team === team) continue;
      const dx = source.x - enemy.x, dy = source.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      if (distance < nearest) {
        nearest = distance;
        x = clamp(enemy.x + (distance > EPS ? dx / distance : 1) * 1.5, 0.5, state.config.columns - 0.5);
        y = clamp(enemy.y + (distance > EPS ? dy / distance : 0) * 1.5, 0.5, state.config.rows - 0.5);
      }
    }
    const existing = state.vortexes.find(v => v.team === team);
    if (existing) { existing.x = x; existing.y = y; existing.expiresAt = state.tick + 6 * TICK_RATE; }
    else state.vortexes.push({ id: state.nextId++, team, x, y, expiresAt: state.tick + 6 * TICK_RATE });
    addEffect(state, kind, team);
  } else if (kind === 'infiltrator') {
    const existing = state.balls.find(b => b.team === team && b.role === 'infiltrator');
    if (existing && existing.expiresAt !== null) {
      existing.expiresAt += 10 * TICK_RATE;
      const effect = addEffect(state, kind, team);
      effect.expiresAt = existing.expiresAt;
    } else if (state.balls.filter(b => b.team === team).length < MAX_BALLS) {
      const candidates: number[] = [];
      for (let i = 0; i < state.grid.length; i++) if (state.grid[i] !== valueOf(team)) candidates.push(i);
      if (candidates.length) {
        const index = candidates[Math.floor(random(state) * candidates.length)];
        const col = index % state.config.columns, row = Math.floor(index / state.config.columns);
        const radius = attributes(state, team).radius;
        const x = clamp(col + 0.5, radius + EPS, state.config.columns - radius - EPS);
        const y = clamp(row + 0.5, radius + EPS, state.config.rows - radius - EPS);
        // A giant reinforcement must land behind enemy lines too. Prepare its
        // actual footprint rather than teleporting it home during syncBalls.
        overlappingCells(state, x, y, radius + EPS, (c, r) => captureCell(state, c, r, team));
        if (state.winner) return;
        newBall(state, team, x, y, 'infiltrator', 10);
        addEffect(state, kind, team);
      }
    }
  } else if (kind === 'trinity') {
    let added = 0;
    for (let i = 0; i < 2 && state.balls.filter(b => b.team === team).length < MAX_BALLS; i++) {
      newBall(state, team, source.x, source.y, 'trinity', 12);
      added++;
    }
    if (added) addEffect(state, kind, team);
  } else if (kind === 'wormhole') {
    const position = findPosition(state, team, source.radius, source.x, source.y, true);
    if (position) {
      source.x = position.x; source.y = position.y;
      emit(state, { type: 'teleport', team, kind, x: source.x, y: source.y });
    }
    addEffect(state, kind, team);
  } else if (kind === 'turret') {
    const existing = state.turrets.find(t => t.team === team);
    if (existing) { existing.x = source.x; existing.y = source.y; existing.expiresAt = state.tick + 8 * TICK_RATE; }
    else state.turrets.push({ id: state.nextId++, team, x: source.x, y: source.y, expiresAt: state.tick + 8 * TICK_RATE, nextShotAt: state.tick + TICK_RATE });
    addEffect(state, kind, team);
  } else addEffect(state, kind, team);
  syncBalls(state);
}

function paintSegment(state: MatchState, ball: Ball, x1: number, y1: number, x2: number, y2: number): void {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - ball.radius)), maxX = Math.min(state.config.columns - 1, Math.floor(Math.max(x1, x2) + ball.radius));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - ball.radius)), maxY = Math.min(state.config.rows - 1, Math.floor(Math.max(y1, y2) + ball.radius));
  for (let row = minY; row <= maxY; row++) for (let col = minX; col <= maxX; col++) {
    if (circleOverlapsCell(x1, y1, ball.radius, col, row) || circleOverlapsCell(x2, y2, ball.radius, col, row) || sweepCircleCell(x1, y1, x2 - x1, y2 - y1, ball.radius, col, row, 1)) captureCell(state, col, row, ball.team);
  }
}

function applyVortexes(state: MatchState, ball: Ball): number {
  if (ball.capturedBy !== null) {
    const vortex = state.vortexes.find(v => v.id === ball.capturedBy);
    if (vortex && ball.capturedUntil > state.tick && Math.hypot(vortex.x - ball.x, vortex.y - ball.y) < 3) return 0;
    ball.capturedBy = null; ball.capturedUntil = 0;
    const angle = ((ball.id * 2.399963229728653) + state.tick * 0.017) % (Math.PI * 2);
    ball.vx = Math.cos(angle) * state.config.baseSpeed;
    ball.vy = Math.sin(angle) * state.config.baseSpeed;
    ball.holeCooldownUntil = state.tick + TICK_RATE;
    return 1;
  }
  if (ball.holeCooldownUntil > state.tick) return 1;
  let slowdown = 1;
  for (const vortex of state.vortexes) {
    if (vortex.team === ball.team) continue;
    const dx = vortex.x - ball.x, dy = vortex.y - ball.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= 3) continue;
    if (distance < Math.max(0.28, ball.radius * 0.4)) {
      // A visible but brief capture, followed by a full second of immunity.
      ball.capturedBy = vortex.id;
      ball.capturedUntil = state.tick + Math.round(0.35 * TICK_RATE);
      return 0;
    }
    slowdown = 0.65;
    ball.vx += dx / Math.max(distance, EPS) * 36 * DT;
    ball.vy += dy / Math.max(distance, EPS) * 36 * DT;
  }
  return slowdown;
}

function moveBall(state: MatchState, ball: Ball): void {
  const vortexSpeed = applyVortexes(state, ball);
  let attr = attributes(state, ball.team);
  setSpeed(ball, attr.speed * vortexSpeed);
  let remaining = DT;
  for (let iteration = 0; iteration < 20 && remaining > 1e-10 && !state.winner; iteration++) {
    let time = remaining + 1;
    let nx = 0, ny = 0;
    let wall = false;
    let cells: { col: number; row: number }[] = [];
    const consider = (hit: Hit, col?: number, row?: number) => {
      if (hit.time < -EPS || hit.time > remaining + EPS) return;
      if (hit.time < time - EPS) { time = Math.max(0, hit.time); nx = hit.nx; ny = hit.ny; cells = []; wall = col === undefined; }
      else if (Math.abs(hit.time - time) <= EPS) { nx += hit.nx; ny += hit.ny; wall ||= col === undefined; }
      else return;
      if (col !== undefined && row !== undefined) cells.push({ col, row });
    };
    if (ball.vx < -EPS) consider({ time: (ball.radius - ball.x) / ball.vx, nx: 1, ny: 0 });
    else if (ball.vx > EPS) consider({ time: (state.config.columns - ball.radius - ball.x) / ball.vx, nx: -1, ny: 0 });
    if (ball.vy < -EPS) consider({ time: (ball.radius - ball.y) / ball.vy, nx: 0, ny: 1 });
    else if (ball.vy > EPS) consider({ time: (state.config.rows - ball.radius - ball.y) / ball.vy, nx: 0, ny: -1 });
    if (!attr.ghost) {
      const endX = ball.x + ball.vx * remaining, endY = ball.y + ball.vy * remaining;
      const minX = Math.max(0, Math.floor(Math.min(ball.x, endX) - ball.radius)), maxX = Math.min(state.config.columns - 1, Math.floor(Math.max(ball.x, endX) + ball.radius));
      const minY = Math.max(0, Math.floor(Math.min(ball.y, endY) - ball.radius)), maxY = Math.min(state.config.rows - 1, Math.floor(Math.max(ball.y, endY) + ball.radius));
      for (let row = minY; row <= maxY; row++) for (let col = minX; col <= maxX; col++) {
        if (state.grid[row * state.config.columns + col] === valueOf(ball.team)) continue;
        const hit = sweepCircleCell(ball.x, ball.y, ball.vx, ball.vy, ball.radius, col, row, remaining);
        if (hit) consider(hit, col, row);
      }
    }
    // Pickups participate in the same first-event search as walls and cells.
    // This applies a speed/radius change at contact, and never collects objects
    // from the old trajectory after a teleport. ID only breaks exact ties.
    let pickupHit: { time: number; id: number } | null = null;
    for (const pickup of state.pickups) {
      const pickupTime = sweepPointCircle(ball.x, ball.y, ball.vx, ball.vy, pickup.x, pickup.y, ball.radius + 0.32, remaining);
      if (pickupTime !== null && (!pickupHit || pickupTime < pickupHit.time - EPS || (Math.abs(pickupTime - pickupHit.time) <= EPS && pickup.id < pickupHit.id))) pickupHit = { time: pickupTime, id: pickup.id };
    }
    const collect = pickupHit !== null && pickupHit.time <= time + EPS;
    if (collect) time = pickupHit!.time;
    const x1 = ball.x, y1 = ball.y;
    const movedFor = Math.min(remaining, time);
    ball.x += ball.vx * movedFor; ball.y += ball.vy * movedFor;
    if (attr.ghost) paintSegment(state, ball, x1, y1, ball.x, ball.y);
    remaining -= movedFor;
    if (collect) {
      const index = state.pickups.findIndex(p => p.id === pickupHit!.id);
      const [pickup] = state.pickups.splice(index, 1);
      activateBonus(state, pickup.kind, ball.team, ball.id);
      attr = attributes(state, ball.team);
      setSpeed(ball, attr.speed * vortexSpeed);
      continue;
    }
    const hit = time <= movedFor + EPS;
    if (hit) {
      if (cells.length && ball.radius > BASE_RADIUS * 1.5) {
        // A giant sweeps a broad contact front; it doesn't merely collect more
        // pickups. Unlike demolition this does not add a full 3×3 depth.
        overlappingCells(state, ball.x, ball.y, ball.radius + 0.55, (col, row) => {
          if (state.grid[row * state.config.columns + col] !== valueOf(ball.team) && !cells.some(c => c.col === col && c.row === row)) cells.push({ col, row });
        });
      }
      for (const cell of cells) {
        const reach = attr.wrecking ? 1 : 0;
        for (let row = cell.row - reach; row <= cell.row + reach; row++) for (let col = cell.col - reach; col <= cell.col + reach; col++) captureCell(state, col, row, ball.team);
      }
      const length = Math.hypot(nx, ny);
      if (length > EPS) {
        nx /= length; ny /= length;
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) { ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny; }
        ball.x += nx * EPS; ball.y += ny * EPS;
      } else { ball.vx = -ball.vx; ball.vy = -ball.vy; }
      if (wall || cells.length) emit(state, { type: 'bounce', team: ball.team, x: ball.x, y: ball.y });
      if (movedFor < 1e-10) remaining = Math.max(0, remaining - 1e-8);
    }
    attr = attributes(state, ball.team);
  }
  ball.x = clamp(ball.x, ball.radius, state.config.columns - ball.radius);
  ball.y = clamp(ball.y, ball.radius, state.config.rows - ball.radius);
}

function spawnPickup(state: MatchState): void {
  if (!state.config.enabledBonuses.length || state.pickups.length >= 4) return;
  const candidates: { x: number; y: number }[] = [];
  for (let row = 0; row < state.config.rows; row++) for (let col = 0; col < state.config.columns; col++) {
    const x = col + 0.5, y = row + 0.5;
    if (state.pickups.some(p => Math.abs(p.x - x) < 1 && Math.abs(p.y - y) < 1)) continue;
    if (state.balls.some(b => Math.hypot(b.x - x, b.y - y) < b.radius + 0.6)) continue;
    candidates.push({ x, y });
  }
  if (!candidates.length) return;
  const position = candidates[Math.floor(random(state) * candidates.length)];
  const kind = state.config.enabledBonuses[Math.floor(random(state) * state.config.enabledBonuses.length)];
  state.pickups.push({ id: state.nextId++, kind, ...position, expiresAt: state.tick + 15 * TICK_RATE });
}

function updateTurrets(state: MatchState): void {
  for (const turret of state.turrets) {
    if (state.tick < turret.nextShotAt) continue;
    turret.nextShotAt += TICK_RATE;
    let target: { x: number; y: number } | null = null;
    let closest = Infinity;
    for (let i = 0; i < state.grid.length; i++) {
      if (state.grid[i] === valueOf(turret.team)) continue;
      const x = i % state.config.columns + 0.5, y = Math.floor(i / state.config.columns) + 0.5;
      const distance = (x - turret.x) ** 2 + (y - turret.y) ** 2;
      if (distance < closest) { closest = distance; target = { x, y }; }
    }
    if (!target || state.projectiles.length >= 32) continue;
    const length = Math.sqrt(closest);
    state.projectiles.push({ id: state.nextId++, team: turret.team, x: turret.x, y: turret.y, vx: length > EPS ? (target.x - turret.x) / length * 16 : 16, vy: length > EPS ? (target.y - turret.y) / length * 16 : 0, expiresAt: state.tick + 4 * TICK_RATE });
  }
  const surviving = [];
  for (const projectile of state.projectiles) {
    let bestTime = DT + 1;
    let target: { col: number; row: number } | null = null;
    const endX = projectile.x + projectile.vx * DT, endY = projectile.y + projectile.vy * DT;
    for (let row = Math.max(0, Math.floor(Math.min(projectile.y, endY) - 0.12)); row <= Math.min(state.config.rows - 1, Math.floor(Math.max(projectile.y, endY) + 0.12)); row++) {
      for (let col = Math.max(0, Math.floor(Math.min(projectile.x, endX) - 0.12)); col <= Math.min(state.config.columns - 1, Math.floor(Math.max(projectile.x, endX) + 0.12)); col++) {
        if (state.grid[row * state.config.columns + col] === valueOf(projectile.team)) continue;
        const hit = sweepCircleCell(projectile.x, projectile.y, projectile.vx, projectile.vy, 0.12, col, row, DT);
        if (hit && hit.time < bestTime) { bestTime = hit.time; target = { col, row }; }
      }
    }
    if (target) captureCell(state, target.col, target.row, projectile.team);
    else {
      projectile.x = endX; projectile.y = endY;
      if (endX >= 0 && endX < state.config.columns && endY >= 0 && endY < state.config.rows && projectile.expiresAt > state.tick) surviving.push(projectile);
    }
  }
  state.projectiles = surviving;
}

function expire(state: MatchState): void {
  for (const effect of state.effects) if (effect.expiresAt <= state.tick) emit(state, { type: 'expire', team: effect.team, kind: effect.kind, x: 0, y: 0 });
  state.effects = state.effects.filter(e => e.expiresAt > state.tick);
  state.balls = state.balls.filter(b => b.expiresAt === null || b.expiresAt > state.tick);
  state.pickups = state.pickups.filter(p => p.expiresAt > state.tick);
  state.vortexes = state.vortexes.filter(v => v.expiresAt > state.tick);
  // Keep a turret for its eighth shot, then retire it after updateTurrets.
  state.turrets = state.turrets.filter(t => t.expiresAt >= state.tick);
  state.projectiles = state.projectiles.filter(p => p.expiresAt > state.tick);
}

function appendHistory(state: MatchState): void {
  state.history.push({ tick: state.tick, latte: state.counts.latte / state.grid.length });
  if (state.history.length > 1800) state.history = state.history.filter((_, index) => index % 2 === 0 || index === state.history.length - 1);
}

export function stepMatch(state: MatchState, ticks = 1): void {
  state.events = [];
  const steps = Number.isFinite(ticks) ? Math.max(0, Math.floor(ticks)) : 0;
  for (let i = 0; i < steps && !state.winner; i++) {
    state.tick++;
    expire(state);
    syncBalls(state);
    // Snapshot prevents newly created balls from receiving an extra move this tick.
    for (const ball of [...state.balls]) { if (state.winner) break; moveBall(state, ball); }
    if (!state.winner) updateTurrets(state);
    state.turrets = state.turrets.filter(t => t.expiresAt > state.tick);
    if (!state.winner && state.tick >= state.nextSpawnAt) {
      spawnPickup(state);
      state.nextSpawnAt = state.tick + Math.round(state.config.spawnSeconds * TICK_RATE);
    }
    const needed = Math.ceil(state.grid.length * state.config.winThreshold - 1e-9);
    for (const team of teams) if (!state.winner && state.counts[team] >= needed) {
      state.winner = team;
      emit(state, { type: 'victory', team, x: state.config.columns / 2, y: state.config.rows / 2 });
      break;
    }
    if (state.tick % TICK_RATE === 0 || state.winner) appendHistory(state);
  }
}
