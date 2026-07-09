import { useWindowDimensions } from 'react-native';
import { typography, sp, radius } from '../theme';

/** Smallest-side dp threshold for tablet layout (Android sw600dp guideline). */
const TABLET_BREAKPOINT = 600;

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  // Guard: dimensions can briefly be 0 on first mount / rotation
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const shortestSide = Math.min(safeWidth, safeHeight);
  const isTablet = shortestSide >= TABLET_BREAKPOINT;
  const isPhone = !isTablet;

  const typeScale = Math.min(Math.max(fontScale || 1, 1), 1.35);
  const scaleSize = (size) => Math.round(size * typeScale);

  // Form-factor typography: bump display/title/body on tablets; honor OS fontScale.
  const type = {
    display: { ...typography.display, size: scaleSize(isTablet ? 40 : typography.display.size), lineHeight: scaleSize(isTablet ? 46 : typography.display.lineHeight) },
    title: { ...typography.title, size: scaleSize(isTablet ? 28 : typography.title.size), lineHeight: scaleSize(isTablet ? 34 : typography.title.lineHeight) },
    title2: { ...typography.title2, size: scaleSize(isTablet ? 23 : typography.title2.size), lineHeight: scaleSize(isTablet ? 29 : typography.title2.lineHeight) },
    body: { ...typography.body, size: scaleSize(isTablet ? 17 : typography.body.size), lineHeight: scaleSize(isTablet ? 23 : typography.body.lineHeight) },
    bodyStrong: { ...typography.bodyStrong, size: scaleSize(isTablet ? 17 : typography.bodyStrong.size), lineHeight: scaleSize(isTablet ? 23 : typography.bodyStrong.lineHeight) },
    caption: { ...typography.caption, size: scaleSize(typography.caption.size), lineHeight: scaleSize(typography.caption.lineHeight) },
    captionStrong: { ...typography.captionStrong, size: scaleSize(typography.captionStrong.size), lineHeight: scaleSize(typography.captionStrong.lineHeight) },
    micro: { ...typography.micro, size: scaleSize(typography.micro.size), lineHeight: scaleSize(typography.micro.lineHeight) },
    label: { ...typography.label, size: scaleSize(typography.label.size), lineHeight: scaleSize(typography.label.lineHeight) },
    overline: { ...typography.overline, size: scaleSize(typography.overline.size), lineHeight: scaleSize(typography.overline.lineHeight) },
    mono: { ...typography.mono, size: scaleSize(isTablet ? 30 : typography.mono.size), lineHeight: scaleSize(isTablet ? 36 : typography.mono.lineHeight) },
  };

  const horizontalPadding = isTablet ? 32 : 16;

  return {
    width: safeWidth,
    height: safeHeight,
    fontScale,
    isTablet,
    isPhone,
    typography: type,
    spacing: sp,
    radius,

    /** Max width for home / form-style screens */
    contentMaxWidth: isTablet ? 520 : safeWidth,
    /** Max width for chat (messages + input) */
    chatMaxWidth: isTablet ? 720 : safeWidth,
    horizontalPadding,
    /** Inner gutter used inside cards */
    cardPadding: isTablet ? sp.lg : sp.md,
    mediaImageSize: isTablet ? 320 : 220,
    mediaVideoWidth: isTablet ? 360 : 240,
    mediaVideoHeight: isTablet ? 240 : 160,
    touchMin: isTablet ? 48 : 44,
    /** Subtle side gutter on tablet "stage" surfaces */
    stageGutter: isTablet ? 24 : 0,
  };
}
