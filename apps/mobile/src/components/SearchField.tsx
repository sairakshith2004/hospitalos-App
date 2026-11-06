import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import {
  borders,
  colors,
  elevation,
  iconSize,
  layout,
  radius,
  spacing,
  typography,
} from '@/theme/tokens';

import { Icon } from './Icon';
import { IconButton } from './IconButton';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  /** Used as both placeholder and accessible label, e.g. "Search patients". */
  label: string;
  onSubmit?: () => void;
  testID?: string;
};

export function SearchField({ value, onChangeText, label, onSubmit, testID }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.root, focused && styles.focused]} accessibilityRole="search">
      <Icon name="search" size={iconSize.md} color={focused ? colors.primary : colors.textMuted} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
      />
      {value.length > 0 ? (
        <IconButton
          icon="close"
          size="sm"
          variant="plain"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouchTarget + spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: borders.thin,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceStrong,
    ...elevation.low,
  },
  focused: { borderColor: colors.borderFocus },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: layout.minTouchTarget,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
});

/** Same component under the design-system name. */
export const SearchBar = SearchField;
