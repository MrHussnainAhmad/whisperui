import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Modal, Pressable, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Icon from './Icon';
import { sp, radius, shadows } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const OPTS = [
  { key: 'camera', icon: 'camera-outline', label: 'Camera' },
  { key: 'photo', icon: 'image-outline', label: 'Photo' },
  { key: 'video', icon: 'videocam-outline', label: 'Video' },
  { key: 'file', icon: 'document-text-outline', label: 'File' },
];

const MAX_MEDIA_BYTES = 3_000_000;
const MAX_MEDIA_BASE64_CHARS = 4_000_000;

export default function MediaPickerButton({ onImageSelected, onVideoSelected, onFileSelected, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { colors, typography } = useTheme();
  const { isTablet, touchMin } = useResponsiveLayout();
  const isDisabled = disabled || isProcessing;

  const pick = async (key) => {
    if (isDisabled) return;
    setOpen(false);
    setIsProcessing(true);
    try {
      if (key === 'camera') {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) { setIsProcessing(false); return; }
        const r = await ImagePicker.launchCameraAsync({
          quality: 0.45,
          base64: true,
          allowsEditing: false,
          exif: false,
        });
        if (!r.canceled && r.assets?.[0]) {
          const imageData = r.assets[0].base64;
          if (!imageData || imageData.length > MAX_MEDIA_BASE64_CHARS) {
            Alert.alert('Too large', 'Image must be under 3 MB. Try a smaller photo.');
          } else {
            onImageSelected({ imageData, mimeType: r.assets[0].mimeType || 'image/jpeg' });
          }
        }
      }
      else if (key === 'photo') {
        const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!p.granted) { setIsProcessing(false); return; }
        const r = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.45,
          base64: true,
          allowsEditing: false,
          exif: false,
        });
        if (!r.canceled && r.assets?.[0]) {
          const imageData = r.assets[0].base64;
          if (!imageData || imageData.length > MAX_MEDIA_BASE64_CHARS) {
            Alert.alert('Too large', 'Image must be under 3 MB. Try a smaller photo.');
          } else {
            onImageSelected({ imageData, mimeType: r.assets[0].mimeType || 'image/jpeg' });
          }
        }
      }
      else if (key === 'video') {
        const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!p.granted) { setIsProcessing(false); return; }
        const r = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'],
          quality: 0.4,
          videoMaxDuration: 30,
        });
        if (!r.canceled && r.assets?.[0]) {
          const a = r.assets[0];
          const size = a.fileSize ?? a.size ?? 0;
          if (size > MAX_MEDIA_BYTES) {
            Alert.alert('Too large', 'Video must be under 3 MB.');
            setIsProcessing(false);
            return;
          }
          const b64 = await FileSystem.readAsStringAsync(a.uri, { encoding: 'base64' });
          if (b64.length > MAX_MEDIA_BASE64_CHARS) {
            Alert.alert('Too large', 'Video must be under 3 MB.');
            setIsProcessing(false);
            return;
          }
          onVideoSelected({ videoData: b64, mimeType: a.mimeType || 'video/mp4' });
        }
      }
      else if (key === 'file') {
        const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
        if (!r.canceled && r.assets?.[0]) {
          const a = r.assets[0];
          if (a.size > MAX_MEDIA_BYTES) {
            Alert.alert('Too large', 'File must be under 3 MB.');
            setIsProcessing(false);
            return;
          }
          const b64 = await FileSystem.readAsStringAsync(a.uri, { encoding: 'base64' });
          onFileSelected({ fileData: b64, mimeType: a.mimeType || 'application/octet-stream', fileName: a.name || 'file', fileSize: a.size || 0 });
        }
      }
    } catch (err) {
      Alert.alert('Error', `Could not process media: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={[
          s.trigger,
          { width: touchMin, height: touchMin, borderRadius: touchMin / 2, backgroundColor: colors.surface2, borderColor: colors.border },
          isDisabled && s.triggerOff,
        ]}
        activeOpacity={0.7}
        disabled={isDisabled}
        onPress={() => { if (!isDisabled) setOpen(true); }}
        accessibilityLabel="Attach media"
        accessibilityRole="button"
      >
        <Icon name="add" size={isTablet ? 24 : 22} color={isDisabled ? colors.textTertiary : colors.accent} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={[s.overlay, { backgroundColor: colors.overlay }]} onPress={() => setOpen(false)}>
          <Pressable onPress={() => {}}>
            <View
              style={[
                s.sheet,
                { backgroundColor: colors.surface1, borderColor: colors.hairline },
                isTablet && s.sheetTablet,
              ]}
            >
              <View style={[s.handle, { backgroundColor: colors.textTertiary }]} />
              <View style={[s.grid, isTablet && s.gridTablet]}>
                {OPTS.map((o) => (
                  <TouchableOpacity
                    key={o.key}
                    style={[s.optBtn, isTablet && s.optBtnTablet]}
                    activeOpacity={0.7}
                    onPress={() => pick(o.key)}
                    accessibilityRole="button"
                    accessibilityLabel={o.label}
                  >
                    <View style={[s.optCircle, { backgroundColor: colors.accentTint, borderColor: colors.hairline }, isTablet && s.optCircleTablet]}>
                      <Icon name={o.icon} size={isTablet ? 30 : 26} color={colors.accent} />
                    </View>
                    <Text style={[typography.caption, { color: colors.textSecondary }, isTablet && { fontSize: 14 }]}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[s.cancelBtn, { backgroundColor: colors.surface2 }]}
                activeOpacity={0.8}
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[typography.body, { color: colors.danger }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Global Processing Loader */}
      {isProcessing && (
        <Modal transparent visible={true}>
          <View style={[s.processingContainer, { backgroundColor: colors.overlay }]}>
            <View style={[s.processingBox, { backgroundColor: colors.surface1, borderColor: colors.hairline }]}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[typography.body, { color: colors.text, marginTop: sp.md }]}>Processing...</Text>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  trigger: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: sp.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  triggerOff: { opacity: 0.4 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: sp.sm,
    paddingBottom: sp.xl,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadows.lg,
  },
  sheetTablet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    marginBottom: sp.lg,
    marginHorizontal: sp.lg,
    borderRadius: radius.xxl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: sp.lg,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: sp.md,
  },
  gridTablet: {
    paddingHorizontal: sp.xl,
    paddingVertical: sp.sm,
  },
  optBtn: {
    alignItems: 'center',
    width: 72,
  },
  optBtnTablet: { width: 92 },
  optCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: sp.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optCircleTablet: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  cancelBtn: {
    marginTop: sp.lg,
    marginHorizontal: sp.lg,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingBox: {
    padding: sp.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    minWidth: 140,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
