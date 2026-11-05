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
import { primaryRole } from '@/features/session/session-role';
import { useSignedInSession } from '@/features/session/SessionProvider';
import { borders, colors, layout, radius, spacing, tints } from '@/theme/tokens';

import { getDashboardContent } from './dashboard-content';
import { formatDateEyebrow, greetingFor } from './format';

/** Shown next to every block of synthetic figures, so demo content is never mistaken for live data. */
function DemoDataLabel() {
  return (
    <View style={styles.demoLabel}>
      <StatusChip label="DEMO DATA" tone="warning" dot={false} />
    </View>
  );
}

/**
 * Home tab. Synthetic figures appear only for a development demo session, always labelled
 * DEMO DATA; every other session sees an honest empty state until the API serves real figures
 * (phase 1.11). See `dashboard-content.ts` and docs/MOBILE-ARCHITECTURE.md §6.1.
 */
export function HomeScreen() {
  const router = useRouter();
  const session = useSignedInSession();
  const role = primaryRole(session);
  const content = getDashboardContent(session);
  const isDemo = content.kind === 'demo';
  const modules = visibleModules(session);
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
            {role?.title ?? 'No role assigned'}
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
          {role ? `${role.summary}.` : 'Ask your administrator to assign your role.'}
        </AppText>
        <View style={styles.heroFooter}>
          <StatusChip
            label={isDemo ? 'DEVELOPMENT PREVIEW' : 'NO LIVE DATA YET'}
            tone={isDemo ? 'warning' : 'neutral'}
            dot={false}
          />
        </View>
      </GlassCard>

      <SectionHeader title="At a glance" meta="Today" />
      {content.kind === 'demo' ? (
        <View style={styles.demoBlock} testID="demo-figures">
          <DemoDataLabel />
          <View style={styles.metrics}>
            {content.dashboard.metrics.map((item) => (
              <MetricCard
                key={item.label}
                label={item.label}
                value={item.value}
                caption={item.caption}
                tone={item.tone}
                style={styles.metricCard}
              />
            ))}
          </View>
        </View>
      ) : (
        <GlassCard padding="none" elevation="low">
          <EmptyState
            icon="info"
            title="No live figures yet"
            message="Figures for your role appear here once HospitalOS is connected to the hospital server (Release 1, phase 1.11)."
          />
        </GlassCard>
      )}

      <SectionHeader
        title="Priority tasks"
        action={{ label: 'View all', onPress: () => router.navigate('/queue') }}
      />
      {content.kind === 'demo' ? (
        <View style={styles.demoBlock} testID="demo-tasks">
          <DemoDataLabel />
          <GlassCard padding="none" elevation="low">
            {content.dashboard.tasks.map((task, index) => (
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
        </View>
      ) : (
        <GlassCard padding="none" elevation="low">
          <EmptyState
            icon="queue"
            title="No tasks yet"
            message="Your work queue fills from the hospital server as each Release 1 workflow arrives."
          />
        </GlassCard>
      )}

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
        {isDemo ? 'HOSPITALOS MOBILE · DEVELOPMENT PREVIEW · DEMO DATA' : 'HOSPITALOS MOBILE'}
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
  demoBlock: { gap: spacing.sm },
  demoLabel: { alignSelf: 'flex-start' },
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
