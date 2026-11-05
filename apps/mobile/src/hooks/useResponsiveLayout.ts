import { useWindowDimensions } from 'react-native';

import { layout } from '@/theme/tokens';

export type ResponsiveLayout = {
  width: number;
  isWide: boolean;
  screenPadding: number;
};

/** Breakpoint helper so screens never hard-code widths. */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width } = useWindowDimensions();
  const isWide = width >= layout.wideBreakpoint;
  return {
    width,
    isWide,
    screenPadding: isWide ? layout.screenPaddingWide : layout.screenPadding,
  };
}
