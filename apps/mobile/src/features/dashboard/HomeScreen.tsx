import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  EmptyState,
  GlassCard,
  Icon,
  ListRow,
  MetricCard,
  ScreenContainer,
  SectionHeader,
  StatusChip,
} from '@/components';
import { visibleModules } from '@/features/access/modules';
import { ROLES } from '@/features/access/roles';
import { useSignedInSession } from '@/features/session/SessionProvider';
import { borders, colors, layout, radius, spacing, tints } from '@/theme/tokens';

import { demoMetrics, demoTasks } from './demo-data';
import { formatDateEyebrow, greetingFor } from './format';

/** Home tab. Per-role dashboards replace the generic metrics in Step 8. */
export function HomeScreen() {
  const router = useRouter();
  const session = useSignedInSession();
  const role = ROLES[session.demoRoleId];
  const modules = visibleModules(session.permissions);
  const now = new Date();

  return (
    <ScreenContainer bottomInset={false}>
      <View style={styles.topRow}>
        <View style={styles.greeting}>
          <AppText variant="overline" color="textMuted">
            {formatDateEyebrow(now)}
          </AppText>
          <AppText variant="title" accessibilityRole="header">
            {greetingFor(now)}
          </AppText>
          <AppText variant="bodySmall" color="textMuted">
            {role.title}
          </AppText>
        </View>
        <Pressable
          onPress={() => router.navigate('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          hitSlop={spacing.xs}
        >
          <Avatar name={session.displayName} />
        </Pressable>
      </View>

      <GlassCard padding="lg">
        <AppText variant="overline" color="textMuted">
          HOSPITALOS OVERVIEW
        </AppText>
        <AppText variant="display" style={styles.heroTitle}>
          Your hospital,{'\n'}in one view.
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.heroCopy}>
          {role.summary}.
        </AppText>
        <View style={styles.heroFooter}>
          <StatusChip label="All systems operational" tone="success" />
          <StatusChip label="DEMO DATA" tone="warning" dot={false} />
        </View>
      </GlassCard>

      <SectionHeader title="At a glance" meta="Today" />
      <View style={styles.metrics}>
        {demoMetrics.map((item) => (
          <MetricCard
            key={item.label}
            label={item.label}
            value={item.value}
            caption={item.change}
            tone={item.tone}
            style={styles.metricCard}
          />
        ))}
      </View>

      <SectionHeader
        title="Priority tasks"
        action={{ label: 'View all', onPress: () => router.navigate('/queue') }}
      />
      <GlassCard padding="none" elevation="low">
        {demoTasks.map((task, index) => (
          <View key={task.title} style={index > 0 && styles.divider}>
            <ListRow
              title={task.title}
              subtitle={task.detail}
              leading={
                <View style={styles.well}>
                  <AppText variant="label" color="primary">
                    {String(index + 1).padStart(2, '0')}
                  </AppText>
                </View>
              }
              trailing={<StatusChip label={task.tag} tone={task.tone} />}
            />
          </View>
        ))}
      </GlassCard>

      <SectionHeader title="Modules" />
      {modules.length === 0 ? (
        <EmptyState
          title="No modules available"
          message="Your account has no module permissions yet. Contact your administrator."
          icon="lock"
        />
      ) : (
        <View style={styles.grid}>
          {modules.map((module) => (
            <Pressable
              key={module.id}
              onPress={() =>
                router.push({ pathname: '/modules/[moduleId]', params: { moduleId: module.id } })
              }
              accessibilityRole="button"
              accessibilityLabel={`${module.title} module`}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            >
              <View style={styles.well}>
                <Icon name={module.icon} size={18} color={colors.primary} />
              </View>
              <AppText variant="label">{module.title}</AppText>
            </Pressable>
          ))}
        </View>
      )}

      <AppText variant="overline" color="textMuted" style={styles.footer}>
        HOSPITALOS MOBILE · DESIGN PROTOTYPE · DEMO DATA
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  greeting: { flexShrink: 1, gap: spacing.xs },
  heroTitle: { marginTop: spacing.md },
  heroCopy: { marginTop: spacing.sm, maxWidth: layout.proseMaxWidth },
  heroFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { flexGrow: 1, flexBasis: layout.metricMinWidth },
  divider: { borderTopWidth: borders.hairline, borderTopColor: colors.border },
  well: {
    width: layout.iconWell,
    height: layout.iconWell,
    borderRadius: radius.sm,
    backgroundColor: tints.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Two per row on phones, four on tablets: pure flex wrapping, no width measuring.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    flexGrow: 1,
    flexBasis: layout.tileMinWidth,
    minHeight: layout.minTouchTarget,
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: borders.thin,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
  },
  tilePressed: { backgroundColor: colors.surfacePressed },
  footer: { textAlign: 'center' },
});
