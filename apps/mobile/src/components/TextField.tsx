import { useId, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { borders, colors, layout, radius, spacing, typography } from '@/theme/tokens';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

type Props = Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'editable'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  helperText?: string | undefined;
  errorText?: string | undefined;
  disabled?: boolean;
  /** For secure fields: a button that shows or hides the text. */
  revealable?: boolean;
};

/** Labelled single-line input with helper and error text. The label is always visible. */
export function TextField({
  label,
  helperText,
  errorText,
  disabled = false,
  revealable = false,
  secureTextEntry,
  onFocus,
  onBlur,
  ...inputProps
}: Props) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const id = useId();
  const message = errorText ?? helperText;

  return (
    <View style={styles.root}>
      <AppText variant="label" color="textSecondary" nativeID={`${id}-label`}>
        {label}
      </AppText>
      <View style={styles.inputRow}>
        <TextInput
          {...inputProps}
          secureTextEntry={secureTextEntry === true && !revealed}
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
            revealable && styles.withButton,
          ]}
        />
        {revealable && secureTextEntry ? (
          <View style={styles.reveal}>
            <IconButton
              icon={revealed ? 'eye-off' : 'eye'}
              variant="plain"
              size="sm"
              accessibilityLabel={
                revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`
              }
              onPress={() => setRevealed((v) => !v)}
            />
          </View>
        ) : null}
      </View>
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
    minHeight: layout.minTouchTarget + spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: borders.thin,
    borderColor: colors.borderStrong,
    backgroundColor: colors.backgroundElevated,
    color: colors.text,
  },
  // Same border width focused or not, so focusing never shifts the layout.
  focused: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceStrong },
  error: { borderColor: colors.danger },
  disabled: { color: colors.textDisabled, opacity: 0.7 },
  inputRow: { justifyContent: 'center' },
  withButton: { paddingRight: layout.minTouchTarget + spacing.xs },
  reveal: { position: 'absolute', right: spacing.xs },
});

/** Same component under the design-system name. */
export const FormField = TextField;
