import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, typography } from '@/theme/tokens';

export type TextVariant = keyof typeof typography;
export type TextColor =
  | 'text'
  | 'textSecondary'
  | 'textMuted'
  | 'textDisabled'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'textOnAccent';

type Props = TextProps & {
  variant?: TextVariant;
  color?: TextColor;
};

/** Text bound to the type scale. Use instead of raw <Text> so sizes stay on-token. */
export function AppText({ variant = 'body', color = 'text', style, ...rest }: Props) {
  return <Text {...rest} style={[styles[variant], { color: colors[color] }, style]} />;
}

const styles = StyleSheet.create(typography);
