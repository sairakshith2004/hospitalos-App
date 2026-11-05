import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { borders, colors, layout, radius, spacing, typography } from '@/theme/tokens';

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
      <Icon name="search" size={18} color={colors.textMuted} />
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
    minHeight: layout.minTouchTarget,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: borders.thin,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
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
