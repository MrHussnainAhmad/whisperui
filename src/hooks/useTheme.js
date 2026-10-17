import { useColorScheme } from 'react-native';
import { light, dark, tracking } from '../theme';
import { useResponsiveLayout } from './useResponsiveLayout';

/**
 * Resolves the active semantic palette + (form-factor-adjusted) typography.
 *
 * `scheme` is the OS-reported preference. We default to light when the OS
 * reports "no preference" (null) — the most neutral, familiar baseline.
 */
export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = isDark ? dark : light;
  const { typography } = useResponsiveLayout();
  return {
    colors,
    theme: colors.name,
    isDark,
    typography,
    tracking,
  };
}
