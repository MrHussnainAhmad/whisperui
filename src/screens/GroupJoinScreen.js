import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import StatusBar from '../components/StatusBar';
import ScreenContainer from '../components/ScreenContainer';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { connectSocket, getGroupCaptcha, joinGroupChat } from '../services/socket';
import { solveProofOfWork } from '../services/proofOfWork';
import { sp, radius, shadows } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

export default function GroupJoinScreen({ navigation }) {
  const { colors, typography } = useTheme();
  const { horizontalPadding, isTablet } = useResponsiveLayout();
  const [username, setUsername] = useState('');
  const [answer, setAnswer] = useState('');
  const [captcha, setCaptcha] = useState(null);
  const [captchaIndex, setCaptchaIndex] = useState(0);
  const [powSolution, setPowSolution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const securityReady = Number.isSafeInteger(powSolution);

  const loadCaptcha = async () => {
    setLoading(true);
    setPowSolution(null);
    try {
      await connectSocket();
      const nextCaptcha = await getGroupCaptcha();
      const nextSolution = await solveProofOfWork(
        nextCaptcha.id, nextCaptcha.powNonce, nextCaptcha.powDifficultyBits
      );
      setCaptcha(nextCaptcha);
      setPowSolution(nextSolution);
      setCaptchaIndex(0);
      setAnswer('');
    } catch {
      Alert.alert('Offline', 'Cannot reach server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

  useEffect(() => {
    if (!captcha?.id || loading || joining) return undefined;
    const questions = Array.isArray(captcha.questions) && captcha.questions.length
      ? captcha.questions
      : [captcha.question];
    const timer = setTimeout(() => {
      setAnswer('');
      if (captchaIndex + 1 < questions.length) {
        setCaptchaIndex((current) => current + 1);
      } else {
        loadCaptcha();
      }
    }, captcha.refreshEveryMs || 15_000);
    return () => clearTimeout(timer);
  }, [captcha, captchaIndex, loading, joining]);

  const handleJoin = async () => {
    const cleanUsername = username.trim();
    if (!cleanUsername || !captcha?.id || !answer.trim() || !Number.isSafeInteger(powSolution)) return;
    setJoining(true);
    try {
      const result = await joinGroupChat(
        cleanUsername, captcha.id, answer, captchaIndex, powSolution
      );
      navigation.replace('GroupChat', {
        username: result.username,
        activeUsers: result.activeUsers,
        users: result.users,
        messages: result.messages,
        messageTtlMs: result.messageTtlMs,
      });
    } catch (err) {
      Alert.alert('Could not join', err?.message || 'Try another username.');
      await loadCaptcha();
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.surface }]} edges={['top', 'bottom']}>
      <StatusBar />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScreenContainer variant="content">
          <ScrollView
            style={s.flex}
            contentContainerStyle={[
              s.body,
              {
                paddingHorizontal: horizontalPadding,
                paddingBottom: isTablet ? sp.xl * 2 : sp.xl,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            nestedScrollEnabled
            showsVerticalScrollIndicator={isTablet}
          >
            <View style={s.topBar}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to Home"
                hitSlop={8}
                onPress={() => navigation.replace('Home')}
                style={({ pressed }) => [
                  s.backButton,
                  { backgroundColor: colors.surface1, borderColor: colors.hairline },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Icon name="arrow-back" size={20} color={colors.text} />
              </Pressable>
              <Text style={[typography.label, { color: colors.textSecondary }]}>GROUP CHAT</Text>
              <View style={s.topBarSpacer} />
            </View>

            <View style={s.hero}>
              <View style={[s.roomMark, { backgroundColor: colors.accent }]}>
                <Icon name="people" size={22} color="#FFFFFF" />
              </View>
              <Text style={[typography.title, s.heroTitle, { color: colors.text }]}>Choose your identity</Text>
              <Text style={[typography.body, s.heroSubtitle, { color: colors.textSecondary }]}>
                Pick a temporary name for this session. It vanishes when you leave.
              </Text>
            </View>

            <View style={[s.formCard, { backgroundColor: colors.surface1, borderColor: colors.hairline }]}>
              <View style={s.fieldHeader}>
                <Text style={[typography.overline, { color: colors.textSecondary }]}>DISPLAY NAME</Text>
                <Text style={[typography.micro, { color: colors.textTertiary }]}>{username.length} / 20</Text>
              </View>

              <View style={[s.nameField, { backgroundColor: colors.surface2 }]}>
                <TextInput
                  style={[s.nameInput, { color: colors.text }]}
                  placeholder="e.g. nightowl"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Temporary display name"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  value={username}
                  onChangeText={setUsername}
                />
                {username.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear display name"
                    hitSlop={8}
                    onPress={() => setUsername('')}
                  >
                    <Icon name="close-circle" size={19} color={colors.textTertiary} />
                  </Pressable>
                )}
              </View>

              <View style={[s.rule, { backgroundColor: colors.separator }]} />

              <View style={s.fieldHeader}>
                <Text style={[typography.overline, { color: colors.textSecondary }]}>SECURITY CHECK</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Get a new question"
                  disabled={loading || joining}
                  hitSlop={8}
                  onPress={loadCaptcha}
                  style={({ pressed }) => [s.refreshButton, pressed && { opacity: 0.5 }]}
                >
                  <Icon name="refresh" size={16} color={colors.accent} />
                  <Text style={[typography.captionStrong, { color: colors.accent }]}>Refresh</Text>
                </Pressable>
              </View>

              <View style={[s.equation, { backgroundColor: colors.surface2 }]}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[s.question, { color: loading ? colors.textTertiary : colors.text }]}
                >
                  {loading
                    ? 'Loading'
                    : captcha?.questions?.[captchaIndex] || captcha?.question || '--'}
                </Text>
                <Text style={[s.equals, { color: colors.textTertiary }]}>=</Text>
                <View style={[s.answerWrap, { backgroundColor: colors.surface1, borderColor: answer ? colors.accent : colors.border }]}>
                  <TextInput
                    style={[s.answerInput, { color: colors.text }]}
                    placeholder="?"
                    placeholderTextColor={colors.textTertiary}
                    accessibilityLabel="Answer to security check"
                    keyboardType="number-pad"
                    maxLength={3}
                    value={answer}
                    onChangeText={setAnswer}
                    editable={!loading && !joining && securityReady}
                    onSubmitEditing={handleJoin}
                  />
                </View>
              </View>
              <Text style={[typography.caption, { color: colors.textTertiary, marginTop: sp.sm }]}>
                {loading || !securityReady
                  ? 'Preparing the local security check...'
                  : 'A quick check to keep the room human. Refreshes locally every 15 seconds.'}
              </Text>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                title={joining ? 'Joining...' : loading || !securityReady ? 'Preparing security...' : 'Enter Group Chat'}
                iconRight="arrow-forward"
                loading={joining || loading || !securityReady}
                disabled={loading || !securityReady || !username.trim() || !answer.trim()}
                onPress={handleJoin}
                style={{ marginTop: sp.lg }}
              />
            </View>

            <View style={s.roomNote}>
              <View style={[s.liveDot, { backgroundColor: colors.success }]} />
              <Text style={[typography.caption, { color: colors.textTertiary }]}>Public room · Messages fade after 90 seconds</Text>
            </View>
          </ScrollView>
        </ScreenContainer>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  body: { flexGrow: 1, paddingTop: sp.md, paddingBottom: sp.xl },
  topBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarSpacer: { width: 40 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: { alignItems: 'center', paddingTop: sp.xl, paddingBottom: sp.xl },
  roomMark: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp.md,
    ...shadows.sm,
  },
  heroTitle: { textAlign: 'center', letterSpacing: -0.3 },
  heroSubtitle: { maxWidth: 330, textAlign: 'center', marginTop: sp.sm, lineHeight: 22 },
  formCard: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: sp.lg,
    ...shadows.md,
  },
  fieldHeader: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameField: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: sp.md,
    marginTop: sp.sm,
  },
  nameInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: sp.sm,
    fontSize: 17,
    fontWeight: '600',
  },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: sp.lg },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
  },
  equation: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: sp.sm,
    marginTop: sp.sm,
  },
  question: { flex: 1, fontSize: 27, lineHeight: 33, fontWeight: '700', textAlign: 'center' },
  equals: { fontSize: 22, fontWeight: '500', marginHorizontal: sp.sm },
  answerWrap: {
    width: 74,
    height: 58,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  answerInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '700',
  },
  roomNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: sp.lg },
  liveDot: { width: 6, height: 6, borderRadius: radius.full },
});
