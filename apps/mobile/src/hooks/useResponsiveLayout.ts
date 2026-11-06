import { useWindowDimensions } from 'react-native';

import { breakpoints, layout } from '@/theme/tokens';

export type ResponsiveLayout = {
  width: number;
  isWide: boolean;
  /** Narrow phones (under 380 dp): tighter grids and single-column actions. */
  isCompact: boolean;
  screenPadding: number;
};

/** Breakpoint helper so screens never hard-code widths. */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width } = useWindowDimensions();
  const isWide = width >= layout.wideBreakpoint;
  return {
    width,
    isWide,
    isCompact: width < breakpoints.compact + 20,
    screenPadding: isWide ? layout.screenPaddingWide : layout.screenPadding,
  };
}
