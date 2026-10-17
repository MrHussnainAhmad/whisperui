import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import PrivateVideo from './PrivateVideo';
import Icon from './Icon';
import { sp, radius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const fmtSize = (b) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

const fmtTime = (ts) => {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp']);

export default function ChatBubble({ message, isSent, onSave, onOpen, mediaActive = true }) {
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const { colors, typography } = useTheme();
  const { isTablet, mediaImageSize, mediaVideoWidth, mediaVideoHeight } = useResponsiveLayout();
  useEffect(() => {
    if (!mediaActive) {
      setPlaying(false);
    }
  }, [mediaActive]);
  const save = async () => {
    if (!mediaActive || saving || isSent || message?.allowSaving !== true || !onSave) return;
    setPlaying(false);
    setSaving(true);
    try { await onSave(message); } finally { setSaving(false); }
  };

  if (!message || !message.type) return null;

  const isMedia = message.type === 'image' || message.type === 'video';
  const isSystem = message.type === 'system';
  const time = fmtTime(message.ts);

  // Media bubbles render their own content with the bubble chrome around it.
  const mediaRadius = radius.xl;

  const content = () => {
    switch (message.type) {
      case 'image':
        if ((!message.imageData && !message.fileUri) || !IMAGE_MIME_TYPES.has(message.mimeType)) return null;
        return (
          <Image
            source={{ uri: message.fileUri || `data:${message.mimeType};base64,${message.imageData}` }}
            style={{ width: mediaImageSize, height: mediaImageSize, borderRadius: radius.lg }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        );
      case 'video':
        if ((!message.videoData && !message.fileUri) || !VIDEO_MIME_TYPES.has(message.mimeType)) return null;
        return (
          <View>
          <PrivateVideo
            uri={message.fileUri || `data:${message.mimeType};base64,${message.videoData}`}
            style={{ width: mediaVideoWidth, height: mediaVideoHeight, borderRadius: radius.lg }}
            playing={mediaActive && playing}
            onStopped={() => setPlaying(false)}
          />
          <TouchableOpacity disabled={!mediaActive} onPress={() => setPlaying((value) => !value)}
            accessibilityRole="button" accessibilityLabel={playing ? 'Pause video' : 'Play video'}
            style={{ padding: 10 }}>
            <Text style={[typography.caption, { color: colors.text }]}>{playing ? 'Pause' : 'Play video'}</Text>
          </TouchableOpacity>
          </View>
        );
      case 'file':
        return (
          <View style={s.fileRow}>
            <View style={[s.fileIcon, { backgroundColor: colors.accentTint }]}>
              <Icon name="document-outline" size={20} color={colors.accent} />
            </View>
            <View style={s.fileMeta}>
              <Text style={[typography.bodyStrong, { color: isSent ? colors.bubbleSentText : colors.bubbleReceivedText }]} numberOfLines={1}>
                {message.fileName}
              </Text>
              {message.fileSize > 0 && (
                <Text style={[typography.caption, { color: isSent ? 'rgba(255,255,255,0.78)' : colors.textSecondary, marginTop: 1 }]}>
                  {fmtSize(message.fileSize)}
                </Text>
              )}
            </View>
          </View>
        );
      case 'system':
        return <Text style={[typography.caption, { color: colors.textTertiary, textAlign: 'center' }]}>{message.text}</Text>;
      default:
        if (!message.text) return null;
        return (
          <Text style={[typography.body, { color: isSent ? colors.bubbleSentText : colors.bubbleReceivedText }]}>
            {message.text}
          </Text>
        );
    }
  };

  const body = content();
  if (!body) return null;

  // System messages render as a centered muted pill, no tail or timestamp.
  if (isSystem) {
    return (
      <View style={s.systemRow}>
        <View style={[s.systemPill, { backgroundColor: colors.surface3 }]}>
          {body}
        </View>
      </View>
    );
  }

  // Footer (timestamp + ticks) shown inside the bubble's bottom corner for
  // text/file; under media for legibility on photos/video.
  const meta = (
    <View style={[s.meta, isMedia && s.metaMedia]}>
      <Text style={[typography.micro, { color: isSent ? 'rgba(255,255,255,0.78)' : colors.textTertiary }]}>
        {time}
      </Text>
      {isSent && (
        <Icon
          name={
            message.delivery === 'failed'
              ? 'alert-circle'
              : message.delivery === 'sending'
                ? 'time-outline'
                : message.delivery === 'delivered'
                  ? 'checkmark-done'
                  : 'checkmark'
          }
          size={13}
          color={message.delivery === 'failed' ? colors.warning : 'rgba(255,255,255,0.85)'}
          style={s.tick}
        />
      )}
    </View>
  );

  return (
    <View style={[s.row, isSent ? s.rowR : s.rowL]}>
      <View
        style={[
          s.bubble,
          { borderRadius: mediaRadius },
          isSent
            ? { backgroundColor: colors.bubbleSent, borderBottomRightRadius: radius.xs }
            : { backgroundColor: colors.bubbleReceived, borderBottomLeftRadius: radius.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.bubbleReceivedBorder },
          isMedia && s.media,
        ]}
      >
        {['image', 'video', 'file'].includes(message.type) && onOpen ?
          <TouchableOpacity disabled={!mediaActive} accessibilityLabel="Open attachment" onPress={() => {
            setPlaying(false); videoRef.current?.pauseAsync().catch(() => {}); onOpen(message);
          }}>{body}</TouchableOpacity> : body}
        {isSent && ['image', 'video', 'file'].includes(message.type) && message.delivery === 'sending' && (
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round((message.progress || 0) * 100) }}>
            <View style={{ height: 4, backgroundColor: colors.surface3, marginTop: 8 }}>
              <View style={{ height: 4, width: `${Math.round((message.progress || 0) * 100)}%`, backgroundColor: colors.accent }} />
            </View>
            <Text style={[typography.caption, { color: colors.text }]}>{Math.round((message.progress || 0) * 100)}% received by peer</Text>
          </View>
        )}
        {!isSent && message.allowSaving === true && ['image', 'video', 'file'].includes(message.type) && onSave && (
          <TouchableOpacity onPress={save} disabled={saving || !mediaActive}
            accessibilityRole="button" accessibilityLabel="Save attachment" style={{ padding: 10 }}>
            <Icon name={saving ? 'hourglass-outline' : 'download-outline'} size={24} color={colors.accent} />
          </TouchableOpacity>
        )}
        {meta}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { marginVertical: 3, marginHorizontal: sp.md },
  rowR: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowL: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  media: {
    padding: 3,
    overflow: 'hidden',
  },
  // Timestamp / ticks row, anchored bottom-right inside the bubble.
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
    gap: 2,
  },
  metaMedia: {
    // Sit the meta slightly off the media edge.
    marginRight: 4,
    marginBottom: 2,
    marginTop: 5,
  },
  tick: {
    marginLeft: 1,
    marginTop: 0,
  },
  // System message
  systemRow: {
    alignItems: 'center',
    marginVertical: 6,
    marginHorizontal: sp.xl,
  },
  systemPill: {
    paddingHorizontal: sp.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    maxWidth: '90%',
  },
  // File attachment
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    minWidth: 180,
    gap: sp.sm,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileMeta: {
    flex: 1,
  },
});
