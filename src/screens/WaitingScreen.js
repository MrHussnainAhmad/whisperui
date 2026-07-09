import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import StatusBar from '../components/StatusBar';
import Button from '../components/Button';
import { getSocket, cancelSearch } from '../services/socket';
import { sp } from '../theme';
import { useTheme } from '../hooks/useTheme';
import ScreenContainer from '../components/ScreenContainer';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

export default function WaitingScreen({ navigation }) {
  const { colors, typography } = useTheme();
  const { isTablet, horizontalPadding } = useResponsiveLayout();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Smooth ease-in-out pulse for the search ring (1 -> 1.6 -> 1).
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    anim.start();

    const socket = getSocket();
    if (!socket) { navigation.replace('Home'); return; }

    const onMatched = (d) => navigation.replace('Chat', { roomId: d.roomId, chatMode: 'random' });
    const onErr = () => navigation.replace('Home');
    socket.on('matched', onMatched);
    socket.on('error', onErr);

    return () => { anim.stop(); socket.off('matched', onMatched); socket.off('error', onErr); };
  }, []);

  // ringScale goes 1.0 -> 1.6, opacity 0.35 -> 0
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.surface }]} edges={['top', 'bottom']}>
      <StatusBar />
      <ScreenContainer variant="content">
        <View style={s.body}>
          <View style={s.ringStage}>
            <Animated.View
              style={[
                s.ring,
                { borderColor: colors.accent, opacity: ringOpacity, transform: [{ scale: ringScale }] },
                isTablet && s.ringTablet,
              ]}
            />
            <View style={[s.dot, { backgroundColor: colors.accent }, isTablet && s.dotTablet]} />
          </View>
          <Text style={[typography.title, { color: colors.text, marginBottom: sp.xs }]}>Searching</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>Looking for someone online…</Text>
        </View>
        <View style={{ paddingHorizontal: horizontalPadding, marginBottom: sp.xl }}>
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            title="Cancel"
            onPress={() => { cancelSearch(); navigation.replace('Home'); }}
          />
        </View>
      </ScreenContainer>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ringStage: {
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: sp.xl,
  },
  ring: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
  },
  ringTablet: { width: 80, height: 80, borderRadius: 40 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  dotTablet: { width: 20, height: 20, borderRadius: 10 },
});
