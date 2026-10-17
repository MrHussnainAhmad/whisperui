import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Image } from 'react-native';
import StatusBar from '../components/StatusBar';
import { sp, radius, shadows } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

export default function SplashScreen({ navigation }) {
  const { colors, typography, tracking } = useTheme();
  const { isTablet } = useResponsiveLayout();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    let cancelled = false;

    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();

    const run = async () => {
      const started = Date.now();
      const remaining = Math.max(0, 2500 - (Date.now() - started));
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      if (!cancelled) navigation.replace('Home');
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <View style={[s.container, { backgroundColor: colors.surface }]}>
      <StatusBar />
      <Animated.View style={[s.content, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={[s.iconWrap, { backgroundColor: colors.accent, ...shadows.lg }, isTablet && s.iconWrapTablet]}>
          <Image source={require('../../assets/icon.png')} style={[s.iconImage, isTablet && s.iconImageTablet]} />
        </View>
        <Text style={[typography.display, { color: colors.text, letterSpacing: tracking.tight }, isTablet && { fontSize: 42 }]}>
          Whisper
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: sp.sm }, isTablet && { fontSize: 18 }]}>
          No signup. No history. Just talk.
        </Text>
        <Text style={[typography.caption, { color: colors.textTertiary, marginTop: sp.md }]}>
          Connecting...
        </Text>
      </Animated.View>
      <Animated.Text style={[s.footer, { opacity: fade, color: colors.textTertiary }]}>
        End-to-end live relay · Zero persistence
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center' },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: sp.lg,
    overflow: 'hidden',
  },
  iconWrapTablet: { width: 96, height: 96, marginBottom: sp.xl },
  iconImage: { width: 72, height: 72 },
  iconImageTablet: { width: 96, height: 96 },
  footer: {
    position: 'absolute',
    bottom: sp.xxl,
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
