/**
 * Whisper design system.
 *
 * One source of truth for color, typography, spacing, radius, and elevation.
 * Colors are split into `light` and `dark` semantic palettes consumed via the
 * `useTheme()` hook. A legacy `colors` export (dark palette) is kept so any
 * code that still imports `{ colors }` continues to work while being migrated.
 */

// ---------------------------------------------------------------------------
// Spacing scale
// ---------------------------------------------------------------------------
export const sp = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// ---------------------------------------------------------------------------
// Radius scale
// ---------------------------------------------------------------------------
export const radius = {
  none: 0,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  full: 999,
};

// ---------------------------------------------------------------------------
// Typography
// Sizes are phone defaults; `useResponsiveLayout` bumps display/title/body on
// tablets. Weights follow the SF / Roboto canonical set.
// ---------------------------------------------------------------------------
export const typography = {
  display: { size: 34, weight: '700', lineHeight: 40 },
  title: { size: 24, weight: '700', lineHeight: 30 },
  title2: { size: 20, weight: '600', lineHeight: 26 },
  body: { size: 16, weight: '400', lineHeight: 22 },
  bodyStrong: { size: 16, weight: '600', lineHeight: 22 },
  caption: { size: 13, weight: '400', lineHeight: 17 },
  captionStrong: { size: 13, weight: '600', lineHeight: 17 },
  micro: { size: 11, weight: '500', lineHeight: 14 },
  label: { size: 14, weight: '600', lineHeight: 18 },
  overline: { size: 11, weight: '700', lineHeight: 14 }, // uppercase, tracked
  mono: { size: 26, weight: '600', lineHeight: 32, family: 'Courier' },
};

// Letter-spacing helpers (iOS only; harmless elsewhere).
export const tracking = {
  none: 0,
  tight: -0.4,
  normal: 0,
  wide: 0.6,
  wider: 1.4,
};

// ---------------------------------------------------------------------------
// Elevation (soft, layered shadows). Values picked to read as gentle depth,
// not Material harshness. `elevation` only applies on Android.
// ---------------------------------------------------------------------------
export const shadows = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 6,
  },
};

// ---------------------------------------------------------------------------
// Shared brand values
// ---------------------------------------------------------------------------
export const brand = {
  accent: '#5E5CE6', // system indigo — used in both themes
  accentLight: '#7B79F0',
  accentPressed: '#4A48C8',
};

// ---------------------------------------------------------------------------
// Semantic color palettes
// ---------------------------------------------------------------------------
export const light = {
  name: 'light',
  isDark: false,

  // Surfaces (background → layered cards)
  surface: '#F2F2F7', // app background
  surface1: '#FFFFFF', // primary card / sheet
  surface2: '#F7F7FA', // subtle inset / input fill
  surface3: '#ECECF1', // pressed / chip

  // Text
  text: '#1C1C1E',
  textSecondary: '#56565C',
  textTertiary: '#8A8A90',

  // Brand / status
  accent: brand.accent,
  accentPressed: brand.accentPressed,
  accentTint: 'rgba(94, 92, 230, 0.10)', // subtle accent wash
  success: '#30A158',
  successTint: 'rgba(48, 161, 88, 0.12)',
  danger: '#E5484D',
  dangerTint: 'rgba(229, 72, 77, 0.10)',
  warning: '#E0A100',
  warningTint: 'rgba(224, 161, 0, 0.14)',

  // Structure
  separator: 'rgba(60, 60, 67, 0.12)',
  hairline: 'rgba(60, 60, 67, 0.08)',
  border: 'rgba(60, 60, 67, 0.18)',
  overlay: 'rgba(0, 0, 0, 0.45)',

  // Chat bubbles
  bubbleSent: brand.accent,
  bubbleSentText: '#FFFFFF',
  bubbleReceived: '#FFFFFF',
  bubbleReceivedText: '#1C1C1E',
  bubbleReceivedBorder: 'rgba(60, 60, 67, 0.12)',

  // QR
  qrForeground: '#000000',
  qrBackground: '#FFFFFF',
};

export const dark = {
  name: 'dark',
  isDark: true,

  // Surfaces
  surface: '#000000',
  surface1: '#111114',
  surface2: '#1C1C20',
  surface3: '#2C2C31',

  // Text
  text: '#F5F5F7',
  textSecondary: '#AEAEB4',
  textTertiary: '#6D6D74',

  // Brand / status
  accent: brand.accent,
  accentPressed: '#7B79F0',
  accentTint: 'rgba(123, 121, 240, 0.16)',
  success: '#30D158',
  successTint: 'rgba(48, 209, 88, 0.16)',
  danger: '#FF453A',
  dangerTint: 'rgba(255, 69, 58, 0.16)',
  warning: '#FFD60A',
  warningTint: 'rgba(255, 214, 10, 0.16)',

  // Structure
  separator: 'rgba(255, 255, 255, 0.10)',
  hairline: 'rgba(255, 255, 255, 0.06)',
  border: 'rgba(255, 255, 255, 0.14)',
  overlay: 'rgba(0, 0, 0, 0.72)',

  // Chat bubbles
  bubbleSent: brand.accent,
  bubbleSentText: '#FFFFFF',
  bubbleReceived: '#1C1C20',
  bubbleReceivedText: '#F5F5F7',
  bubbleReceivedBorder: 'rgba(255, 255, 255, 0.08)',

  // QR
  qrForeground: '#FFFFFF',
  qrBackground: '#0A0A0A',
};

// ---------------------------------------------------------------------------
// Legacy compatibility — old code imports `{ colors }` expecting the dark set.
// Mirrors the previous tokens so nothing breaks during migration.
// ---------------------------------------------------------------------------
const legacyColors = {
  bg: dark.surface,
  card: dark.surface1,
  card2: dark.surface2,
  elevated: dark.surface3,
  accent: dark.accent,
  accentLight: brand.accentLight,
  white: '#FFFFFF',
  label: dark.text,
  secondary: dark.textSecondary,
  tertiary: dark.textTertiary,
  separator: dark.separator,
  sent: dark.bubbleSent,
  received: dark.bubbleReceived,
  red: dark.danger,
  green: dark.success,
};
export { legacyColors as colors };

export const themes = { light, dark };
