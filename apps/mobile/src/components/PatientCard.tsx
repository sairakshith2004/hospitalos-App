import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { borders, colors, iconSize, layout, radius, spacing, tints } from '@/theme/tokens';

import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

type Props = {
  name: string;
  mrn: string;
  /** Short facts joined by "·", e.g. ["38 y", "Female", "98765 43210"]. */
  meta?: readonly string[];
  /** Status badge or other right-hand content. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Allergy count shown as a warning chip (identity headers and clinical lists). */
  allergies?: number;
  size?: 'row' | 'header';
  /** No side padding: for a row placed inside an already padded card. */
  flush?: boolean;
};

/** Patient identity: initials, name, MRN badge and key facts. Rows navigate; headers don't. */
export function PatientCard({
  name,
  mrn,
  meta = [],
  trailing,
  onPress,
  allergies,
  size = 'row',
  flush = false,
}: Props) {
  const header = size === 'header';
  const body = (
    <>
      <Avatar name={name} size={header ? 'lg' : 'md'} />
      <View style={styles.body}>
        <AppText variant={header ? 'title' : 'bodyStrong'} numberOfLines={2}>
          {name}
        </AppText>
        <View style={styles.badges}>
          <View style={styles.mrn} accessible accessibilityLabel={`MRN ${mrn}`}>
            <AppText variant="caption" color="primary" style={styles.mrnText}>
              {mrn}
            </AppText>
          </View>
          {allergies !== undefined && allergies > 0 ? (
            <View
              style={styles.allergy}
              accessible
              accessibilityLabel={`${allergies} recorded ${allergies === 1 ? 'allergy' : 'allergies'}`}
            >
              <Icon name="warning" size={iconSize.xs} color={colors.warning} />
              <AppText variant="caption" color="warning" style={styles.mrnText}>
                {allergies === 1 ? '1 allergy' : `${allergies} allergies`}
              </AppText>
            </View>
          ) : null}
        </View>
        {meta.length > 0 ? (
          <AppText variant="bodySmall" color="textMuted">
            {meta.join('  ·  ')}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {onPress ? <Icon name="chevron-right" size={iconSize.sm} color={colors.textMuted} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={[styles.root, header && styles.header, flush && styles.flush]}>{body}</View>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${mrn}`}
      style={styles.root}
    >
      {body}
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
  },
  header: { paddingHorizontal: 0, paddingVertical: 0, alignItems: 'flex-start' },
  flush: { paddingHorizontal: 0 },
  body: { flex: 1, gap: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + spacing.xxs },
  mrn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.xs,
    backgroundColor: tints.primary,
    borderWidth: borders.hairline,
    borderColor: colors.border,
  },
  allergy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.xs,
    backgroundColor: tints.warning,
  },
  mrnText: { fontWeight: '700', letterSpacing: 0.4 },
});
