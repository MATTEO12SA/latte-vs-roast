export type Team = 'latte' | 'roast';
export type BonusKind = 'ghost' | 'blackHole' | 'tidalWave' | 'speed' | 'nitro' | 'wreckingBall' | 'colossus' | 'infiltrator' | 'trinity' | 'wormhole' | 'turret';
export type ThemeName = 'coffee' | 'night' | 'contrast';
export interface MatchConfig { columns: number; rows: number; baseSpeed: number; winThreshold: number; spawnSeconds: number; enabledBonuses: BonusKind[]; }
export interface Ball { id: number; team: Team; x: number; y: number; vx: number; vy: number; radius: number; expiresAt: number | null; role: 'original' | 'trinity' | 'infiltrator'; holeCooldownUntil: number; }
export interface Pickup { id: number; kind: BonusKind; x: number; y: number; expiresAt: number; }
export interface Effect { id: number; team: Team; kind: BonusKind; startedAt: number; expiresAt: number; }
export interface Vortex { id: number; team: Team; x: number; y: number; expiresAt: number; }
export interface Turret { id: number; team: Team; x: number; y: number; expiresAt: number; nextShotAt: number; }
export interface Projectile { id: number; team: Team; x: number; y: number; vx: number; vy: number; expiresAt: number; }
export interface TerritorySample { tick: number; latte: number; }
export interface MatchEvent { type: 'capture' | 'bounce' | 'bonus' | 'expire' | 'teleport' | 'victory'; team: Team; x: number; y: number; kind?: BonusKind; count?: number; }
export interface MatchState {
  config: MatchConfig; seed: number; rng: number; tick: number; nextId: number;
  grid: Uint8Array; counts: Record<Team, number>; balls: Ball[]; pickups: Pickup[];
  effects: Effect[]; vortexes: Vortex[]; turrets: Turret[]; projectiles: Projectile[];
  winner: Team | null; events: MatchEvent[]; history: TerritorySample[];
  nextSpawnAt: number; revision: number;
}
export interface MatchRecord { id: string; date: string; seed: number; config: MatchConfig; version: string; winner: Team; ticks: number; history: TerritorySample[]; }
export interface Preferences { theme: ThemeName; sound: boolean; volume: number; reducedEffects: boolean; profile: 'faithful' | 'custom'; customConfig: MatchConfig; }
