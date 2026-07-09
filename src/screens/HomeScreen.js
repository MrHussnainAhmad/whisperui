import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Image,
  Alert, KeyboardAvoidingView, Platform, Keyboard, Share, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import StatusBar from '../components/StatusBar';
import Button from '../components/Button';
import Icon from '../components/Icon';
import {
  getSocket, connectSocket, findRandom, createInvite, cancelInvite,
  joinInvite, extractInviteCode, formatInviteCodeForUser,
} from '../services/socket';
import { sp, radius, shadows } from '../theme';
import { useTheme } from '../hooks/useTheme';
import ScreenContainer from '../components/ScreenContainer';
import InviteQr from '../components/InviteQr';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

export default function HomeScreen({ navigation }) {
  const { colors, typography, tracking } = useTheme();
  const { isTablet, horizontalPadding } = useResponsiveLayout();

  const [inviteCode, setInviteCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const lastCreateTapRef = useRef(0);
  const suppressInviteRef = useRef(false);
  const pendingInviteRef = useRef(null);
  const scanLockedRef = useRef(false);

  useEffect(() => {
    const setup = async () => {
      try { await connectSocket(); } catch { }
      const socket = getSocket();
      if (!socket) return;

      const onMatched = (d) => {
        setGeneratedCode(null);
        setIsCreating(false);
        const code = pendingInviteRef.current;
        navigation.replace('Chat', {
          roomId: d.roomId,
          chatMode: code ? 'invite' : 'random',
          inviteCode: code,
        });
        pendingInviteRef.current = null;
      };
      const onWaiting = () => navigation.replace('Waiting');
      const onErr = (d) => { setIsCreating(false); Alert.alert('Error', d.message || 'Something went wrong'); };

      socket.on('matched', onMatched);
      socket.on('waiting', onWaiting);
      socket.on('error', onErr);

      return () => { socket.off('matched', onMatched); socket.off('waiting', onWaiting); socket.off('error', onErr); };
    };
    const cleanup = setup();
    return () => { cleanup.then?.(fn => fn?.()); };
  }, [navigation]);

  const go = async (fn) => {
    try { await connectSocket(); return (await fn()) ?? true; }
    catch { Alert.alert('Offline', 'Cannot reach server.'); return false; }
  };

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const handleCreateInvite = async () => {
    const now = Date.now();
    const isDoubleTap = now - lastCreateTapRef.current < 350;
    lastCreateTapRef.current = isDoubleTap ? 0 : now;

    if (isDoubleTap) {
      if (isCreating) suppressInviteRef.current = true;
      cancelInvite();
      setIsCreating(false);
      setGeneratedCode(null);
      setShowQr(false);
      return;
    }

    if (isCreating) return;
    setIsCreating(true);
    pendingInviteRef.current = null;
    try {
      await connectSocket();
      const code = await createInvite();
      if (suppressInviteRef.current) {
        suppressInviteRef.current = false;
        cancelInvite();
      } else {
        setGeneratedCode(code);
        pendingInviteRef.current = code;
      }
    } catch (error) {
      Alert.alert('Error', error?.message || 'Could not create invite.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleShareInvite = async () => {
    if (!generatedCode) return;
    const visibleCode = formatInviteCodeForUser(generatedCode);
    try {
      await Share.share({
        title: 'Whisper secure invite',
        message: `${visibleCode}\n\nJoin my private Whisper chat. This one-time invite expires in 5 minutes.`,
      });
    } catch {
      Alert.alert('Share failed', 'Long-press the code to copy it instead.');
    }
  };

  const handleOpenScanner = async () => {
    let permission = cameraPermission;
    if (!permission?.granted) permission = await requestCameraPermission();
    if (!permission?.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to scan an invite QR code.');
      return;
    }
    scanLockedRef.current = false;
    setShowScanner(true);
  };

  const handleQrScanned = ({ data }) => {
    if (scanLockedRef.current) return;
    scanLockedRef.current = true;
    const code = extractInviteCode(data);
    if (!code) {
      Alert.alert('Not a Whisper invite', 'This QR does not contain a valid Whisper invite.', [
        { text: 'Cancel', style: 'cancel', onPress: () => setShowScanner(false) },
        { text: 'Try Again', onPress: () => { scanLockedRef.current = false; } },
      ]);
      return;
    }

    setShowScanner(false);
    setShowJoin(true);
    setInviteCode(formatInviteCodeForUser(code));
    pendingInviteRef.current = code;
    go(() => joinInvite(code));
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.surface }]} edges={['top', 'bottom']}>
      <StatusBar />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScreenContainer variant="content">
          <View style={[s.body, { paddingHorizontal: horizontalPadding }]}>
            {/* ── Header ── */}
            <View style={s.header}>
              <View style={s.logoRow}>
                <View style={[s.logoDot, { backgroundColor: colors.accent }]}>
                  <Image source={require('../../assets/icon.png')} style={s.logoImage} />
                </View>
                <Text style={[typography.title, { color: colors.text, letterSpacing: tracking.tight }]}>Whisper</Text>
              </View>
              <Text style={[typography.body, { color: colors.textSecondary }]}>Anonymous live chat</Text>
            </View>

            {/* ── Actions ── */}
            <View style={s.actions}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                title="Find Random Chat"
                icon="shuffle-outline"
                subtitle="Relay-trusted · no verified peer identity"
                onPress={() => {
                  pendingInviteRef.current = null;
                  go(findRandom);
                }}
              />

              <View style={s.halfRow}>
                <View style={{ flex: 1 }}>
                  <Button
                    variant="subtle"
                    size="lg"
                    fullWidth
                    title={isCreating ? 'Creating...' : 'Create Secure Code'}
                    icon="key-outline"
                    loading={isCreating}
                    onPress={handleCreateInvite}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    variant="subtle"
                    size="lg"
                    fullWidth
                    title="Join Code"
                    icon="arrow-forward"
                    onPress={() => setShowJoin(!showJoin)}
                  />
                </View>
              </View>

              {/* ── Generated code card ── */}
              {generatedCode && (
                <View style={[s.codeCard, { backgroundColor: colors.surface1, borderColor: colors.accent }]}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>Your invite code</Text>
                  <Text
                    selectable
                    style={[typography.mono, { color: colors.accent, letterSpacing: 3, marginVertical: sp.sm }]}
                  >
                    {formatInviteCodeForUser(generatedCode)}
                  </Text>
                  <Text style={[typography.micro, { color: colors.textTertiary }]}>Expires in 5 min · One-time use</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: sp.sm }]}>
                    Share or copy the full TALK-… code. One-time use.
                  </Text>
                  <Button
                    variant="primary"
                    title="Share Invite"
                    icon="share-outline"
                    style={{ marginTop: sp.md }}
                    onPress={handleShareInvite}
                  />
                  <Button
                    variant="ghost"
                    title="Show QR"
                    icon="qr-code-outline"
                    style={{ marginTop: sp.sm }}
                    onPress={() => setShowQr(true)}
                  />
                </View>
              )}

              {/* ── Join area ── */}
              {showJoin && (
                <View style={s.joinArea}>
                  <View style={s.joinRow}>
                    <TextInput
                      style={[s.joinInput, { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.text }]}
                      placeholder="Paste TALK-… invite code"
                      placeholderTextColor={colors.textTertiary}
                      value={inviteCode}
                      onChangeText={setInviteCode}
                      autoCapitalize="characters"
                      maxLength={512}
                      selectTextOnFocus
                    />
                    <Button
                      variant="primary"
                      title="Join"
                      disabled={!inviteCode.trim()}
                      onPress={() => {
                        const code = extractInviteCode(inviteCode);
                        if (!code) {
                          Alert.alert('Invalid code', 'Paste the complete invite code or shared message.');
                          return;
                        }
                        pendingInviteRef.current = code;
                        go(() => joinInvite(code));
                      }}
                    />
                  </View>
                  <Button
                    variant="ghost"
                    title="Scan QR Code"
                    icon="qr-code-outline"
                    fullWidth
                    onPress={handleOpenScanner}
                  />
                </View>
              )}
            </View>
          </View>
        </ScreenContainer>

        {!keyboardVisible && (
          <Text style={[s.footer, { color: colors.textTertiary }]}>
            Messages are live-only and never saved.
          </Text>
        )}
      </KeyboardAvoidingView>

      {/* ── QR display modal ── */}
      <Modal visible={showQr && !!generatedCode} transparent animationType="fade" onRequestClose={() => setShowQr(false)}>
        <View style={[s.qrOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.qrCard, { backgroundColor: colors.surface1, borderColor: colors.hairline, ...shadows.lg }, isTablet && s.qrCardTablet]}>
            <Text style={[typography.title2, { color: colors.text, marginBottom: sp.sm }]}>Secure invite QR</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: sp.md }]}>
              Screenshot this QR and send the image, or let your contact scan it directly.
            </Text>
            {generatedCode && <InviteQr value={formatInviteCodeForUser(generatedCode)} />}
            <Text style={[typography.micro, { color: colors.textTertiary, marginTop: sp.md }]}>One-time use · Expires in 5 minutes</Text>
            <Button variant="primary" fullWidth title="Share Code Instead" icon="share-outline" style={{ marginTop: sp.md }} onPress={handleShareInvite} />
            <Button variant="ghost" fullWidth title="Close" style={{ marginTop: sp.sm }} onPress={() => setShowQr(false)} />
          </View>
        </View>
      </Modal>

      {/* ── QR scanner modal ── */}
      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <View style={[s.scannerScreen, { backgroundColor: colors.surface }]}>
          <SafeAreaView style={s.scannerSafe} edges={['top', 'bottom']}>
            <View style={[s.scannerHeader, { borderBottomColor: colors.hairline }]}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>Scan invite QR</Text>
              <TouchableOpacity onPress={() => setShowScanner(false)} hitSlop={12}>
                <Text style={[typography.label, { color: colors.accent }]}>Close</Text>
              </TouchableOpacity>
            </View>
            <View style={s.cameraWrap}>
              <CameraView
                style={s.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleQrScanned}
              />
              <View pointerEvents="none" style={[s.scanFrame, { borderColor: colors.accent }]} />
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', padding: sp.lg }]}>
              Point the camera at a Whisper invite QR code.
            </Text>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  body: { flex: 1, justifyContent: 'center' },
  header: { marginBottom: sp.xl + 8 },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: sp.sm },
  logoDot: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: sp.sm,
    overflow: 'hidden',
  },
  logoImage: { width: 38, height: 38, resizeMode: 'contain' },
  actions: { gap: sp.md },
  halfRow: { flexDirection: 'row', gap: sp.md },
  codeCard: {
    borderRadius: radius.lg,
    padding: sp.lg,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  joinArea: { gap: sp.sm },
  joinRow: { flexDirection: 'row', gap: sp.sm },
  joinInput: {
    flex: 1,
    borderRadius: radius.md,
    paddingHorizontal: sp.md,
    paddingVertical: 14,
    fontSize: 18,
    letterSpacing: 1.5,
    fontWeight: '600',
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: 'center',
  },
  qrOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: sp.lg },
  qrCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: sp.lg,
    alignItems: 'center',
  },
  qrCardTablet: { maxWidth: 460, padding: sp.xl },
  scannerScreen: { flex: 1 },
  scannerSafe: { flex: 1 },
  scannerHeader: {
    minHeight: 58,
    paddingHorizontal: sp.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cameraWrap: { flex: 1, margin: sp.md, borderRadius: radius.lg, overflow: 'hidden' },
  camera: { flex: 1 },
  scanFrame: {
    position: 'absolute',
    width: 240,
    height: 240,
    alignSelf: 'center',
    top: '50%',
    marginTop: -120,
    borderWidth: 3,
    borderRadius: radius.lg,
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: sp.lg,
    letterSpacing: 0.2,
  },
});
