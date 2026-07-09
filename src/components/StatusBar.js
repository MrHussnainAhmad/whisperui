import { StatusBar as RNStatusBar } from 'expo-status-bar';
import { useTheme } from '../hooks/useTheme';

/**
 * Themed status bar. Light content (white glyphs) in dark mode, dark content
 * in light mode. Translucent so it overlays our surfaces cleanly.
 */
export default function StatusBar() {
  const { isDark } = useTheme();
  return <RNStatusBar style={isDark ? 'light' : 'dark'} />;
}
