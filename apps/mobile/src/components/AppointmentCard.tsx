import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { borders, colors, layout, radius, spacing, tints } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { StatusChip } from './StatusChip';
import { statusTone } from './status';

type Props = {
  /** "10:30", or "Walk-in". */
  time: string;
  token: number | null;
  patientName: string;
  mrn: string;
  doctorName?: string;
  department?: string;
  /** Visit type, e.g. "Follow-up" or "Walk-in". */
  kind?: string;
  status: string;
  statusLabel: string;
  /** Overrides the shared status tone (e.g. "Did not arrive"). */
  tone?: ReturnType<typeof statusTone>;
  onPress?: () => void;
  /** Actions for this appointment (check in, start, cancel…), shown under the details. */
  children?: ReactNode;
};

/** One appointment: time and token column, patient and doctor, visit status, then actions. */
export function AppointmentCard({
  time,
  token,
  patientName,
  mrn,
  doctorName,
  department,
  kind,
  status,
  statusLabel,
  tone,
  onPress,
  children,
}: Props) {
  const details = (
    <View style={styles.top}>
      <View style={styles.timeCol}>
        <AppText variant="subhead" style={styles.time}>
          {time}
        </AppText>
        {token !== null ? (
          <View style={styles.token} accessible accessibilityLabel={`Token ${token}`}>
            <AppText variant="caption" color="primary" style={styles.tokenText}>
              #{token}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {patientName}
        </AppText>
        <StatusChip label={statusLabel} tone={tone ?? statusTone(status)} />
        <AppText variant="caption" color="textMuted">
          {[mrn, kind].filter(Boolean).join('  ·  ')}
        </AppText>
        {doctorName !== undefined ? (
          <AppText variant="bodySmall" color="textSecondary" numberOfLines={1}>
            {[doctorName, department].filter(Boolean).join('  ·  ')}
          </AppText>
        ) : null}
      </View>
    </View>
  );
  return (
    <View style={styles.root}>
      {onPress ? (
        <PressableScale
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${patientName}, ${mrn}, ${time}, ${statusLabel}`}
          accessibilityHint="Opens the patient"
          scaleTo={0.99}
        >
          {details}
        </PressableScale>
      ) : (
        details
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: layout.minTouchTarget,
  },
  timeCol: {
    width: 64,
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingRight: spacing.sm,
    borderRightWidth: borders.hairline,
    borderRightColor: colors.border,
  },
  time: { fontVariant: ['tabular-nums'] },
  token: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.xs,
    backgroundColor: tints.primary,
  },
  tokenText: { fontWeight: '700' },
  body: { flex: 1, gap: spacing.xs },
});
