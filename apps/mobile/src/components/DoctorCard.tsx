import { StyleSheet, View } from 'react-native';

import { borders, colors, iconSize, layout, radius, spacing, tints } from '@/theme/tokens';

import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

type Props = {
  name: string;
  department: string;
  specialty: string;
  /** Consultation fee, already formatted (e.g. "₹500.00"), when the role may see it. */
  fee?: string;
  selected?: boolean;
  onPress: () => void;
};

/** A doctor to choose (booking, walk-in). Selected state is visual and announced. */
export function DoctorCard({ name, department, specialty, fee, selected = false, onPress }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={`${name}, ${department}, ${specialty}`}
      accessibilityState={{ selected, checked: selected }}
      style={[styles.root, selected && styles.selected]}
      scaleTo={0.99}
    >
      <Avatar name={name} size="md" />
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="bodySmall" color="textMuted" numberOfLines={1}>
          {`${department}  ·  ${specialty}`}
        </AppText>
      </View>
      {fee !== undefined ? (
        <AppText variant="figure" color="textSecondary">
          {fee}
        </AppText>
      ) : null}
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <Icon name="check" size={iconSize.xs} color={colors.textOnAccent} /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.minTouchTarget + spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: borders.thin,
    borderColor: 'transparent',
  },
  selected: { backgroundColor: tints.primary, borderColor: colors.primary },
  body: { flex: 1, gap: spacing.xxs },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: borders.focus,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
