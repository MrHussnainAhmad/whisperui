import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { useTheme } from '../hooks/useTheme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { sp, radius, shadows } from '../theme';

/**
 * Unified button. Replaces the per-screen primaryBtn / ghostBtn / halfBtn /
 * subtle styles with one consistent, themed, tablet-aware component.
 *
 * Props:
 *  - variant: 'primary' | 'ghost' | 'danger' | 'subtle'
 *  - size:    'md' | 'lg'
 *  - title:   string label
 *  - icon:    optional Ionicons name rendered to the left of the title
 *  - iconRight: optional Ionicons name rendered to the right of the title
 *  - subtitle: optional second line under the title (used on home actions)
 *  - loading, disabled, onPress, style, fullWidth
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  title,
  subtitle,
  icon,
  iconRight,
  loading = false,
  disabled = false,
  onPress,
  fullWidth = false,
  style,
  testID,
}) {
  const { colors } = useTheme();
  const { isTablet, typography, touchMin } = useResponsiveLayout();
  const isLg = size === 'lg';
  const busy = loading || disabled;
  const minHeight = isLg ? touchMin + 8 : touchMin;

  const palette = resolvePalette(variant, colors);
  const showIcon = icon && !loading;
  const showIconRight = iconRight && !loading;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      style={({ pressed }) => [
        styles.base,
        { minHeight, borderRadius: radius.lg },
        isLg && styles.lg,
        palette.container,
        pressed && palette.pressed,
        fullWidth ? styles.fullWidth : styles.inline,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading && (
        <ActivityIndicator color={palette.spinner} size="small" style={styles.spinner} />
      )}
      {showIcon && (
        <Icon
          name={icon}
          size={isLg ? 20 : 18}
          color={palette.icon}
          style={styles.leadingIcon}
        />
      )}
      <View style={styles.labelCol}>
        <Text
          numberOfLines={1}
          style={[
            typography.label,
            { color: palette.text, letterSpacing: 0.1 },
            isTablet && { fontSize: typography.label.size + 1 },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={2}
            style={[
              typography.caption,
              { color: palette.subText, marginTop: 2 },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {showIconRight && (
        <Icon
          name={iconRight}
          size={isLg ? 20 : 18}
          color={palette.icon}
          style={styles.trailingIcon}
        />
      )}
    </Pressable>
  );
}

function resolvePalette(variant, c) {
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: c.accent, ...shadows.sm },
        pressed: { backgroundColor: c.accentPressed },
        text: '#FFFFFF',
        subText: 'rgba(255,255,255,0.82)',
        icon: '#FFFFFF',
        spinner: '#FFFFFF',
      };
    case 'danger':
      return {
        container: { backgroundColor: c.dangerTint, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
        pressed: { backgroundColor: c.danger, opacity: 0.9 },
        text: c.danger,
        subText: c.danger,
        icon: c.danger,
        spinner: c.danger,
      };
    case 'subtle':
      return {
        container: { backgroundColor: c.surface2 },
        pressed: { backgroundColor: c.surface3 },
        text: c.text,
        subText: c.textSecondary,
        icon: c.accent,
        spinner: c.accent,
      };
    case 'ghost':
    default:
      return {
        container: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
        pressed: { backgroundColor: c.surface3 },
        text: c.text,
        subText: c.textSecondary,
        icon: c.text,
        spinner: c.text,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm + 2,
    gap: sp.sm,
  },
  lg: {
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
  },
  fullWidth: {
    width: '100%',
  },
  inline: {
    alignSelf: 'flex-start',
  },
  disabled: {
    opacity: 0.45,
  },
  spinner: {
    marginRight: 2,
  },
  leadingIcon: {
    marginRight: -2,
  },
  trailingIcon: {
    marginLeft: -2,
  },
  labelCol: {
    flexDirection: 'column',
  },
});
