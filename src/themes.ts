import type { ThemeName } from './types';

export interface Palette {
  name: string;
  bgTop: string;
  bgBottom: string;
  cream: string;
  coffee: string;
  latteBall: string;
  roastBall: string;
  pickup: string;
  pickupInk: string;
  ink: string;
  muted: string;
  line: string;
}

export const THEMES: Record<ThemeName, Palette> = {
  coffee: {
    name: 'Café d’origine', bgTop: '#70513c', bgBottom: '#25170f',
    cream: '#f5ebcb', coffee: '#54290d', latteBall: '#201305', roastBall: '#e8cb69',
    pickup: '#d87661', pickupInk: '#fff0d2', ink: '#f4e7cf', muted: '#b39b84', line: '#917460',
  },
  night: {
    name: 'Nuit', bgTop: '#35344f', bgBottom: '#131321',
    cream: '#d7ddf2', coffee: '#302944', latteBall: '#181326', roastBall: '#bba2f2',
    pickup: '#da88ba', pickupInk: '#21172d', ink: '#e8e5f1', muted: '#9d9bb6', line: '#6d6587',
  },
  contrast: {
    name: 'Contraste renforcé', bgTop: '#222222', bgBottom: '#050505',
    cream: '#fffce8', coffee: '#111111', latteBall: '#111111', roastBall: '#ffdc55',
    pickup: '#ff6545', pickupInk: '#111111', ink: '#ffffff', muted: '#d0d0d0', line: '#a1a1a1',
  },
};
