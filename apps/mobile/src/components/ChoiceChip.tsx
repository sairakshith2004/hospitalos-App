import { StyleSheet, View } from 'react-native';

import { borders, colors, iconSize, layout, radius, spacing, tints } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** radio (one of a set, default) or checkbox. */
  role?: 'radio' | 'checkbox';
  disabled?: boolean;
  testID?: string;
};

/**
 * Selectable chip. The chosen option is highlighted and announced as selected: never shown as a
 * disabled button, and never marked by a text prefix.
 */
export function ChoiceChip({
  label,
  selected,
  onPress,
  role = 'radio',
  disabled,
  testID,
}: ChipProps) {
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected, disabled: disabled ?? false }}
      style={[styles.chip, selected && styles.selected, disabled && styles.disabled]}
    >
      {selected ? <Icon name="check" size={iconSize.sm} color={colors.primary} /> : null}
      <AppText variant="label" color={selected ? 'primary' : 'textSecondary'} numberOfLines={1}>
        {label}
      </AppText>
    </PressableScale>
  );
}

type Option<T extends string> = { value: T; label: string };

/** A wrapping group of choice chips with one selected value. */
export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Accessible name of the group, e.g. "Sex". */
  label: string;
}) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => (
        <ChoiceChip
          key={o.value}
          label={o.label}
          selected={value === o.value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </View>
  );
}

/** Equal-width segments for switching a view (filters, tabs within a screen). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <View style={styles.segments} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <AppText
              variant="label"
              color={selected ? 'text' : 'textMuted'}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {o.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: layout.minTouchTarget - spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: borders.thin,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceStrong,
  },
  selected: { borderColor: colors.primary, backgroundColor: tints.primary },
  disabled: { opacity: 0.5 },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  segments: {
    flexDirection: 'row',
    padding: spacing.xs,
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    borderWidth: borders.thin,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    minHeight: layout.minTouchTarget - spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  segmentSelected: { backgroundColor: colors.surfaceRaised },
});
