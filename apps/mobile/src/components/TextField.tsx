import { useId, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { borders, colors, layout, radius, spacing, typography } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'editable'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  helperText?: string | undefined;
  errorText?: string | undefined;
  disabled?: boolean;
};

/** Labelled single-line input with helper and error text. The label is always visible. */
export function TextField({
  label,
  helperText,
  errorText,
  disabled = false,
  onFocus,
  onBlur,
  ...inputProps
}: Props) {
  const [focused, setFocused] = useState(false);
  const id = useId();
  const message = errorText ?? helperText;

  return (
    <View style={styles.root}>
      <AppText variant="label" color="textSecondary" nativeID={`${id}-label`}>
        {label}
      </AppText>
      <TextInput
        {...inputProps}
        editable={!disabled}
        accessibilityLabel={label}
        accessibilityLabelledBy={`${id}-label`}
        accessibilityState={{ disabled }}
        accessibilityHint={errorText ? `Error: ${errorText}` : helperText}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          focused && styles.focused,
          errorText !== undefined && styles.error,
          disabled && styles.disabled,
        ]}
      />
      {message !== undefined ? (
        <AppText
          variant="caption"
          color={errorText !== undefined ? 'danger' : 'textMuted'}
          accessibilityLiveRegion={errorText !== undefined ? 'polite' : 'none'}
        >
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs + spacing.xxs },
  input: {
    ...typography.body,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: borders.thin,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceStrong,
    color: colors.text,
  },
  focused: { borderColor: colors.borderFocus, borderWidth: borders.focus },
  error: { borderColor: colors.danger },
  disabled: { color: colors.textDisabled, backgroundColor: colors.backgroundElevated },
});
