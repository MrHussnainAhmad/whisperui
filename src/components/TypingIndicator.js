import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { sp, radius } from '../theme';

/**
 * Animated three-dot "typing" bubble. A peer is typing when this is rendered.
 * Each dot pulses with a small staggered delay; the loop is native-driven.
 */
export default function TypingIndicator() {
  const { colors } = useTheme();
  const dots = [useRef(new Animated.Value(0.35)).current, useRef(new Animated.Value(0.35)).current, useRef(new Animated.Value(0.35)).current];

  useEffect(() => {
    const animations = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, {
            toValue: 1,
            duration: 420,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(d, {
            toValue: 0.35,
            duration: 420,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    const composite = Animated.parallel(animations);
    composite.start();
    return () => composite.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.row}>
      <View style={[styles.bubble, { backgroundColor: colors.bubbleReceived, borderColor: colors.bubbleReceivedBorder }]}>
        {dots.map((d, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: colors.textTertiary,
                opacity: d,
                transform: [
                  {
                    scale: d.interpolate({
                      inputRange: [0.35, 1],
                      outputRange: [0.7, 1],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
    alignSelf: 'flex-start',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.xl,
    borderBottomLeftRadius: radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
