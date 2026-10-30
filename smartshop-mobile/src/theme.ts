import { Appearance, Platform } from 'react-native';

const light = {
  primary: '#0f766e',
  primaryDark: '#115e59',
  onPrimary: '#ffffff',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#dbe3ee',
  danger: '#b91c1c',
  dangerBg: '#fee2e2',
  success: '#15803d',
  successBg: '#d1fae5',
  neutralBg: '#e5e7eb',
};

const dark = {
  primary: '#2dd4bf',
  primaryDark: '#14b8a6',
  onPrimary: '#06201d',
  background: '#0b1220',
  card: '#111c2e',
  text: '#e2e8f0',
  muted: '#94a3b8',
  border: '#233047',
  danger: '#f87171',
  dangerBg: '#3b1518',
  success: '#4ade80',
  successBg: '#0f2e1c',
  neutralBg: '#1e293b',
};

// Le thème suit le réglage du téléphone (ou du navigateur) au moment où l'app s'ouvre
function detectDark(): boolean {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && !!window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  }
  return Appearance.getColorScheme() === 'dark';
}

export const isDark = detectDark();
export const colors = isDark ? dark : light;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = 14;