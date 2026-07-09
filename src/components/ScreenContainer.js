import { StyleSheet, View } from 'react-native';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useTheme } from '../hooks/useTheme';

/**
 * Centers and caps content width on tablets so UI does not stretch edge-to-edge.
 * Background uses the themed surface so the whole app shell flips with the OS
 * color scheme.
 *
 * variant:
 *  - 'content' (default) -> contentMaxWidth (520 on tablet)
 *  - 'chat'              -> chatMaxWidth   (720 on tablet)
 */
export default function ScreenContainer({ children, variant = 'content', style, innerStyle }) {
  const { isTablet, contentMaxWidth, chatMaxWidth, stageGutter } = useResponsiveLayout();
  const { colors } = useTheme();
  const maxWidth = variant === 'chat' ? chatMaxWidth : contentMaxWidth;

  return (
    <View style={[styles.outer, { backgroundColor: colors.surface }, style]}>
      <View
        style={[
          styles.inner,
          isTablet && { maxWidth, width: '100%', alignSelf: 'center', paddingHorizontal: stageGutter },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, width: '100%', minHeight: 0 },
  inner: { flex: 1, width: '100%', minHeight: 0 },
});
