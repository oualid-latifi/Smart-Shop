// Identité visuelle SmartShop : bleu nuit + bleu électrique, cartes arrondies.
// L'application est toujours affichée en thème sombre (comme la maquette de référence).

const palette = {
  primary: '#2f6bff',
  primaryDark: '#1d4fd8',
  primarySoft: '#16295a', // fond des pastilles et icônes bleues
  onPrimary: '#ffffff',
  background: '#0a1224',
  card: '#111c33',
  cardAlt: '#17233f', // cartes en relief (champs, vignettes produit)
  text: '#eef3ff',
  muted: '#8c9cbd',
  border: '#1f2c4a',
  danger: '#ff5b6b',
  dangerBg: '#3a1622',
  success: '#2fd07a',
  successBg: '#0f2e22',
  warning: '#f5a524',
  warningBg: '#3a2b0e',
  violet: '#8b7bff',
  violetBg: '#241f4d',
  neutralBg: '#1a2744',
};

export const isDark = true;
export const colors = palette;

// Dégradé de la carte "Ventes du jour" et des boutons mis en avant
export const heroGradient = ['#3b7bff', '#1d4fd8'] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = 16;

/** Couleur stable dérivée d'un nom (avatars des clients et des employés). */
export function avatarColor(name: string): { fg: string; bg: string } {
  const tones = [
    { fg: '#6ea0ff', bg: '#16295a' },
    { fg: '#2fd07a', bg: '#0f2e22' },
    { fg: '#f5a524', bg: '#3a2b0e' },
    { fg: '#8b7bff', bg: '#241f4d' },
    { fg: '#ff7aa8', bg: '#3a1630' },
    { fg: '#3cc8e0', bg: '#0f2c36' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return tones[Math.abs(hash) % tones.length];
}
