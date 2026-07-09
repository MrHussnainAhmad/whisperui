import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, AppState, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getSocket, sendMessage, sendImage, sendVideo, sendFile, leaveRoom, reportUser,
  startKeyExchange, isE2EReady, ensureKeypair, resetE2E, configureChatSecurity,
  verifyChat, canSendMessages, decryptIncoming, sendTyping,
} from '../services/socket';
import {
  addScreenshotListener,
  preventScreenCaptureAsync,
  allowScreenCaptureAsync,
  enableAppSwitcherProtectionAsync,
  disableAppSwitcherProtectionAsync,
  isAvailableAsync,
} from 'expo-screen-capture';
import { deriveSharedKey, getSafetyCode } from '../services/e2e';
import ChatBubble from '../components/ChatBubble';
import MediaPickerButton from '../components/MediaPickerButton';
import ScreenContainer from '../components/ScreenContainer';
import SafetyVerifyOverlay from '../components/SafetyVerifyOverlay';
import TypingIndicator from '../components/TypingIndicator';
import StatusBar from '../components/StatusBar';
import Icon from '../components/Icon';
import { sp, radius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const MAX_RENDERED_MESSAGES = 200;
const MAX_RENDERED_MEDIA_CHARS = 12_000_000;
const BACKGROUND_LEAVE_GRACE_MS = 4000;

function appendBoundedMessage(previous, message) {
  const candidates = [...previous, message].slice(-MAX_RENDERED_MESSAGES);
  const kept = [];
  let mediaChars = 0;
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    const data = candidate?.imageData || candidate?.videoData || candidate?.fileData || '';
    if (data && mediaChars + data.length > MAX_RENDERED_MEDIA_CHARS) continue;
    mediaChars += data.length;
    kept.push(candidate);
  }
  return kept.reverse();
}

function endChatSession(navigation, reasonCode) {
  resetE2E();
  navigation.replace('ChatEnded', { reasonCode });
}

export default function ChatScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, typography, isDark } = useTheme();
  const { isTablet, horizontalPadding, touchMin } = useResponsiveLayout();
  const roomId = route.params?.roomId;
  const chatMode = route.params?.chatMode || 'random';
  const inviteCode = route.params?.inviteCode || null;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [securing, setSecuring] = useState(true);
  const [verified, setVerified] = useState(false);
  const [safetyCode, setSafetyCode] = useState(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [pendingDropped, setPendingDropped] = useState(false);

  const listRef = useRef(null);
  const lastCountRef = useRef(0);
  const inChatRef = useRef(true);
  const verifiedRef = useRef(false);
  const pendingEncryptedRef = useRef([]);
  const authFailureShownRef = useRef(false);
  const typingActiveRef = useRef(false);
  const typingIdleRef = useRef(null);
  const peerTypingIdleRef = useRef(null);
  const backgroundTimerRef = useRef(null);
  const endedRef = useRef(false);

  const chatLocked = securing || !verified;
  const canSend = canSendMessages();

  const processIncoming = (encrypted) => {
    try {
      const msg = decryptIncoming(encrypted);
      setMessages((p) => appendBoundedMessage(p, {
        id: uid(),
        ...msg,
        isSent: false,
        ts: Date.now(),
      }));
    } catch {
      if (!authFailureShownRef.current) {
        authFailureShownRef.current = true;
        setMessages((p) => appendBoundedMessage(p, {
          id: uid(),
          type: 'system',
          isSent: false,
          ts: Date.now(),
          text: 'An invalid, replayed, or unauthenticated message was blocked.',
        }));
      }
    }
  };

  const unlockChat = async () => {
    await verifyChat();
    verifiedRef.current = true;
    setVerified(true);
    const pending = pendingEncryptedRef.current;
    pendingEncryptedRef.current = [];
    pending.forEach(processIncoming);
  };

  const stopOwnTyping = () => {
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    typingIdleRef.current = null;
    if (typingActiveRef.current) sendTyping(false);
    typingActiveRef.current = false;
  };

  const handleTextChange = (value) => {
    setText(value);
    if (!verifiedRef.current) return;
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    if (!value.trim()) {
      stopOwnTyping();
      return;
    }
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      sendTyping(true);
    }
    typingIdleRef.current = setTimeout(stopOwnTyping, 1400);
  };

  const finishChat = (reasonCode) => {
    if (endedRef.current) return;
    endedRef.current = true;
    inChatRef.current = false;
    stopOwnTyping();
    setMessages([]);
    setPeerTyping(false);
    pendingEncryptedRef.current = [];
    verifiedRef.current = false;
    if (backgroundTimerRef.current) {
      clearTimeout(backgroundTimerRef.current);
      backgroundTimerRef.current = null;
    }
    endChatSession(navigation, reasonCode);
  };

  useEffect(() => {
    configureChatSecurity({ inviteCode, chatMode });
  }, [inviteCode, chatMode]);

  useEffect(() => {
    if (!roomId) {
      navigation.replace('Home');
      return;
    }

    const socket = getSocket();
    if (!socket?.connected) {
      navigation.replace('ChatEnded', { reasonCode: 'connection_lost' });
      return;
    }

    inChatRef.current = true;
    endedRef.current = false;

    const onPeerKey = async (d) => {
      try {
        if (isE2EReady()) return;
        await ensureKeypair();
        await deriveSharedKey(d.publicKey);
        const code = await getSafetyCode();
        setSafetyCode(code);
        if (chatMode === 'random') await unlockChat();
        setSecuring(false);
      } catch {
        Alert.alert('Security Error', 'Could not establish a secure connection.');
        finishChat('connection_lost');
      }
    };

    const onEncrypted = (d) => {
      if (typeof d?.encrypted !== 'string') return;
      if (!verifiedRef.current) {
        const queuedChars = pendingEncryptedRef.current.reduce((n, value) => n + value.length, 0);
        if (pendingEncryptedRef.current.length < 10 && queuedChars + d.encrypted.length <= 5_592_408) {
          pendingEncryptedRef.current.push(d.encrypted);
        } else {
          setPendingDropped(true);
        }
        return;
      }
      processIncoming(d.encrypted);
      setPeerTyping(false);
    };

    const onEnd = (d) => {
      finishChat(d?.reasonCode || 'peer_left');
    };

    const onSecurityAlert = (d) => {
      if (d?.source !== 'peer-claim') return;
      const alertText = d.type === 'screenshot'
        ? 'Your peer reported a screenshot event. This is a peer claim, not proof that capture was blocked.'
        : 'Your peer reported a screen-recording event. This is a peer claim, not proof that capture was blocked.';
      setMessages((p) => appendBoundedMessage(p, {
        id: uid(), type: 'system', text: alertText, isSent: false, ts: Date.now(),
      }));
    };

    const onPeerReady = () => startKeyExchange();

    const onPeerTyping = (d) => {
      if (peerTypingIdleRef.current) clearTimeout(peerTypingIdleRef.current);
      if (d?.active !== true) {
        setPeerTyping(false);
        return;
      }
      setPeerTyping(true);
      peerTypingIdleRef.current = setTimeout(() => setPeerTyping(false), 2500);
    };

    const onRateLimited = (d) => {
      const labels = {
        'key-exchange': 'security setup',
        'security-alert': 'security alert',
        report: 'report',
        'chat-ready': 'chat ready',
      };
      const action = labels[d?.action] || 'action';
      setMessages((p) => appendBoundedMessage(p, {
        id: uid(),
        type: 'system',
        isSent: false,
        ts: Date.now(),
        text: `The ${action} rate limit was reached. Please wait before retrying.`,
      }));
    };

    const onSocketError = (d) => {
      if (typeof d?.message !== 'string') return;
      setMessages((p) => appendBoundedMessage(p, {
        id: uid(),
        type: 'system',
        isSent: false,
        ts: Date.now(),
        text: d.message,
      }));
    };

    const onDisconnect = () => {
      if (!inChatRef.current || endedRef.current) return;
      finishChat('connection_lost');
    };

    socket.on('peer-key', onPeerKey);
    socket.on('receive-encrypted', onEncrypted);
    socket.on('chat-ended', onEnd);
    socket.on('peer-security-alert', onSecurityAlert);
    socket.on('peer-ready', onPeerReady);
    socket.on('peer-typing', onPeerTyping);
    socket.on('rate-limited', onRateLimited);
    socket.on('error', onSocketError);
    socket.on('disconnect', onDisconnect);

    let captureEnabled = false;
    const setupCaptureProtection = async () => {
      try {
        const available = await isAvailableAsync();
        if (available) {
          await preventScreenCaptureAsync('chat');
          captureEnabled = true;
          if (Platform.OS === 'ios') {
            await enableAppSwitcherProtectionAsync(0.75);
          }
        }
      } catch { /* optional platform support */ }
    };

    setupCaptureProtection();

    let sub = { remove() {} };
    try {
      sub = addScreenshotListener(() => {
        if (socket?.connected) socket.emit('security-alert', { type: 'screenshot' });
      });
    } catch { /* optional */ }

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && inChatRef.current && socket?.connected) {
        if (backgroundTimerRef.current) clearTimeout(backgroundTimerRef.current);
        backgroundTimerRef.current = setTimeout(() => {
          if (!inChatRef.current || endedRef.current) return;
          if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') return;
          leaveRoom();
          finishChat('app_background');
        }, BACKGROUND_LEAVE_GRACE_MS);
        return;
      }
      if (state === 'active' && backgroundTimerRef.current) {
        clearTimeout(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
      }
    });

    socket.emit('chat-ready');
    startKeyExchange();

    return () => {
      inChatRef.current = false;
      if (backgroundTimerRef.current) {
        clearTimeout(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
      }
      setMessages([]);
      pendingEncryptedRef.current = [];
      verifiedRef.current = false;
      socket.off('peer-key', onPeerKey);
      socket.off('receive-encrypted', onEncrypted);
      socket.off('chat-ended', onEnd);
      socket.off('peer-security-alert', onSecurityAlert);
      socket.off('peer-ready', onPeerReady);
      socket.off('peer-typing', onPeerTyping);
      socket.off('rate-limited', onRateLimited);
      socket.off('error', onSocketError);
      socket.off('disconnect', onDisconnect);
      stopOwnTyping();
      if (peerTypingIdleRef.current) clearTimeout(peerTypingIdleRef.current);
      sub.remove();
      appStateSub.remove();
      if (captureEnabled) allowScreenCaptureAsync('chat').catch(() => {});
      if (Platform.OS === 'ios') disableAppSwitcherProtectionAsync().catch(() => {});
      resetE2E();
    };
  }, [roomId, navigation, chatMode]);

  useEffect(() => {
    if (messages.length > lastCountRef.current) {
      lastCountRef.current = messages.length;
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handleVerify = async () => {
    try {
      await unlockChat();
    } catch {
      Alert.alert('Verification Error', 'Could not unlock this secure chat. Please leave and try again.');
    }
  };

  const handleLeaveFromVerify = () => {
    leaveRoom();
    finishChat('verification_cancelled');
  };

  const doSend = () => {
    const t = text.trim();
    if (!t || !canSend) return;
    if (!sendMessage(t)) {
      Alert.alert('Send failed', 'Message could not be sent. Check your connection.');
      return;
    }
    stopOwnTyping();
    setMessages((p) => appendBoundedMessage(p, {
      id: uid(), type: 'text', text: t, isSent: true, ts: Date.now(),
    }));
    setText('');
  };

  const doImg = (payload) => {
    if (!canSend) return;
    if (!sendImage(payload.imageData, payload.mimeType)) {
      Alert.alert('Unsupported image', 'This image type or size cannot be sent safely.');
      return;
    }
    setMessages((p) => appendBoundedMessage(p, {
      id: uid(), type: 'image', ...payload, isSent: true, ts: Date.now(),
    }));
  };

  const doVid = (payload) => {
    if (!canSend) return;
    if (!sendVideo(payload.videoData, payload.mimeType)) {
      Alert.alert('Unsupported video', 'This video type or size cannot be sent safely.');
      return;
    }
    setMessages((p) => appendBoundedMessage(p, {
      id: uid(), type: 'video', ...payload, isSent: true, ts: Date.now(),
    }));
  };

  const doFile = (payload) => {
    if (!canSend) return;
    if (!sendFile(payload.fileData, payload.mimeType, payload.fileName, payload.fileSize)) {
      Alert.alert('Unsupported file', 'This file metadata or size cannot be sent safely.');
      return;
    }
    setMessages((p) => appendBoundedMessage(p, {
      id: uid(), type: 'file', ...payload, isSent: true, ts: Date.now(),
    }));
  };

  const confirmLeave = () => Alert.alert('Leave chat?', 'This conversation will be gone forever.', [
    { text: 'Stay', style: 'cancel' },
    {
      text: 'Leave',
      style: 'destructive',
      onPress: () => {
        leaveRoom();
        finishChat('user_left');
      },
    },
  ]);

  const confirmReport = () => Alert.alert('Report', 'This ends the chat for both users.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Report',
      style: 'destructive',
      onPress: () => {
        reportUser();
        finishChat('reported');
      },
    },
  ]);

  const inputPlaceholder = securing
    ? 'Securing…'
    : !verified
      ? (chatMode === 'invite' ? 'Verify security first…' : 'Starting chat…')
      : 'Message';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['top', 'left', 'right']}>
      <StatusBar />
      <ScreenContainer variant="chat">
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
          enabled
        >
          <View style={[
            styles.hdr,
            {
              paddingLeft: horizontalPadding,
              paddingRight: horizontalPadding,
              backgroundColor: colors.surface1,
              borderBottomColor: colors.separator,
            },
          ]}>
            <View style={[styles.hdrSide, styles.hdrSideLeft, { width: touchMin }]}>
              <TouchableOpacity
                onPress={confirmLeave}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Leave chat"
              >
                <Icon name="close" size={isTablet ? 24 : 22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.hdrCenter}>
              <View style={styles.hdrTitleWrap}>
                <Text style={[
                  typography.bodyStrong,
                  { color: colors.text, textAlign: 'center' },
                  isTablet && { fontSize: 18 },
                ]}>
                  {chatMode === 'invite' ? 'Private' : 'Anonymous'}
                </Text>
                <View style={[
                  styles.hdrDot,
                  { backgroundColor: colors.textTertiary },
                  verified && chatMode === 'invite' && { backgroundColor: colors.success },
                ]} />
              </View>
              {verified && safetyCode && (
                <Text style={[
                  typography.micro,
                  { color: colors.textTertiary, marginTop: 2, textAlign: 'center' },
                  isTablet && { fontSize: 12 },
                ]}>
                  {chatMode === 'invite'
                    ? `Invite-authenticated · ${safetyCode}`
                    : 'Relay-trusted · peer unverified'}
                </Text>
              )}
            </View>
            <View style={[styles.hdrSide, styles.hdrSideRight, { width: touchMin }]}>
              <TouchableOpacity
                onPress={confirmReport}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Report user"
              >
                <Icon name="flag-outline" size={isTablet ? 22 : 20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {pendingDropped && !verified && (
            <View style={[styles.notice, { backgroundColor: colors.warningTint }]}>
              <Text style={[typography.caption, { color: colors.warning, textAlign: 'center' }]}>
                Some early messages were dropped while securing the channel.
              </Text>
            </View>
          )}

          <FlatList
            ref={listRef}
            data={messages}
            renderItem={({ item }) => <ChatBubble message={item} isSent={item.isSent} />}
            keyExtractor={(i) => i.id}
            style={styles.list}
            contentContainerStyle={[styles.listContent, { paddingHorizontal: horizontalPadding }]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          />

          <View style={[styles.typingRow, { paddingHorizontal: horizontalPadding, backgroundColor: colors.surface }]}>
            {peerTyping ? <TypingIndicator /> : <View style={{ height: 8 }} />}
          </View>

          <View style={[
            styles.bar,
            chatLocked && styles.barDisabled,
            {
              paddingHorizontal: horizontalPadding,
              backgroundColor: colors.surface1,
              borderTopColor: colors.separator,
              paddingBottom: Platform.OS === 'ios'
                ? (keyboardVisible ? sp.sm : Math.max(insets.bottom, sp.sm))
                : (keyboardVisible ? sp.xs : Math.max(insets.bottom, sp.xs)),
            },
          ]}>
            <MediaPickerButton
              onImageSelected={doImg}
              onVideoSelected={doVid}
              onFileSelected={doFile}
              disabled={chatLocked}
            />
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface2,
                  color: colors.text,
                  borderRadius: isTablet ? 24 : 20,
                  fontSize: isTablet ? 18 : 16,
                  minHeight: isTablet ? 48 : 40,
                  maxHeight: isTablet ? 120 : 100,
                },
              ]}
              placeholder={inputPlaceholder}
              placeholderTextColor={colors.textTertiary}
              value={text}
              onChangeText={handleTextChange}
              multiline
              scrollEnabled
              textAlignVertical="center"
              maxLength={2000}
              editable={!chatLocked}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                isTablet && styles.sendBtnTablet,
                { backgroundColor: colors.accent },
                (!text.trim() || !canSend) && { backgroundColor: colors.surface3 },
              ]}
              activeOpacity={0.7}
              disabled={!text.trim() || !canSend}
              onPress={doSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <Icon name="send" size={isTablet ? 22 : 20} color={colors.bubbleSentText} style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </ScreenContainer>

      {securing && (
        <View style={[styles.securingOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(242,242,247,0.92)' }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[typography.title2, { color: colors.text, marginTop: sp.md }]}>
            Securing Connection
          </Text>
          <Text style={[typography.body, { color: colors.textTertiary, marginTop: sp.xs }]}>
            Establishing end-to-end encryption…
          </Text>
        </View>
      )}

      {chatMode === 'invite' && !securing && !verified && safetyCode && (
        <SafetyVerifyOverlay
          safetyCode={safetyCode}
          onVerify={handleVerify}
          onLeave={handleLeaveFromVerify}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  typingRow: { minHeight: 28, justifyContent: 'center' },
  hdr: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sp.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hdrSide: { width: 44, alignItems: 'center', justifyContent: 'center' },
  hdrSideLeft: { alignItems: 'flex-start' },
  hdrSideRight: { alignItems: 'flex-end' },
  hdrCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hdrTitleWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  hdrDot: {
    position: 'absolute',
    left: -14,
    top: '50%',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: -4,
  },
  notice: { paddingVertical: sp.sm, paddingHorizontal: sp.md },
  securingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  list: { flex: 1 },
  listContent: { flexGrow: 1, justifyContent: 'flex-end', paddingVertical: sp.sm },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: sp.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    paddingHorizontal: sp.md,
    paddingVertical: 10,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: sp.sm,
    marginBottom: 2,
  },
  sendBtnTablet: { width: 44, height: 44, borderRadius: 22 },
  barDisabled: { opacity: 0.5 },
});
