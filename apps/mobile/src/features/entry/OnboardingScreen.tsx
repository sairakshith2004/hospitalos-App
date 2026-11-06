import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  BrandMark,
  Divided,
  GlassCard,
  Icon,
  PrimaryButton,
  ScreenContainer,
  type IconName,
} from '@/components';
import { useSession } from '@/features/session/SessionProvider';
import { colors, iconSize, layout, radius, spacing, tints } from '@/theme/tokens';

const POINTS: readonly { icon: IconName; title: string; detail: string }[] = [
  {
    icon: 'shield',
    title: 'Secure staff access',
    detail: 'Accounts are created by your hospital. Sessions end when idle.',
  },
  {
    icon: 'people',
    title: 'Role-based workspaces',
    detail: 'You see only the modules and actions your role allows.',
  },
  {
    icon: 'pulse',
    title: 'Connected operations',
    detail: 'Reception, clinicians, pharmacy, laboratory and billing on the same records.',
  },
];

/** One-time introduction before sign-in. */
export function OnboardingScreen() {
  const router = useRouter();
  const { markIntroSeen } = useSession();
  return (
    <ScreenContainer>
      <View style={styles.head}>
        <BrandMark size="lg" />
        <AppText variant="display" accessibilityRole="header" style={styles.centerText}>
          Welcome to HospitalOS
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.centerText}>
          Secure staff access, role-based workspaces and connected hospital operations.
        </AppText>
      </View>
      <GlassCard tone="hero" padding="none" enterIndex={0}>
        <Divided>
          {POINTS.map((p) => (
            <View key={p.title} style={styles.row} accessible>
              <View style={styles.well}>
                <Icon name={p.icon} size={iconSize.md} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <AppText variant="bodyStrong">{p.title}</AppText>
                <AppText variant="bodySmall" color="textMuted">
                  {p.detail}
                </AppText>
              </View>
            </View>
          ))}
        </Divided>
      </GlassCard>
      <PrimaryButton
        label="Get started"
        fullWidth
        size="lg"
        onPress={() => {
          markIntroSeen();
          router.replace('/sign-in');
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl },
  centerText: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  well: {
    width: layout.iconWell + spacing.sm,
    height: layout.iconWell + spacing.sm,
    borderRadius: radius.md,
    backgroundColor: tints.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: spacing.xxs },
});
