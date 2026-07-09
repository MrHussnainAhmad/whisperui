import { useColorScheme } from 'react-native';
import { light, dark, typography as baseType, tracking } from '../theme';

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
  return {
    colors,
    theme: colors.name,
    isDark,
    typography: baseType,
    tracking,
  };
}
