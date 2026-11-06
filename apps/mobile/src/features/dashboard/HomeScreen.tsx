import { hospitalInfoSchema } from '@hospitalos/contracts';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Avatar,
  BrandMark,
  Divided,
  EmptyState,
  GlassCard,
  Icon,
  IconButton,
  ListRow,
  MetricCard,
  PressableScale,
  ScreenContainer,
  SectionHeader,
  StatusChip,
} from '@/components';
import { visibleModules } from '@/features/access/modules';
import { primaryRole } from '@/features/session/session-role';
import { useSignedInSession } from '@/features/session/SessionProvider';
import { useApiQuery } from '@/services/api/hooks';
import { borders, colors, iconSize, layout, radius, spacing, tints } from '@/theme/tokens';

import { getDashboardContent } from './dashboard-content';
import { formatDateEyebrow, greetingFor } from './format';
import { LiveDashboard } from './LiveDashboard';
import { quickActionsFor } from './role-home';

/** Shown next to every block of synthetic figures, so demo content is never mistaken for live data. */
function DemoDataLabel() {
  return (
    <View style={styles.demoLabel}>
      <StatusChip label="DEMO DATA" tone="warning" dot={false} />
    </View>
  );
}

/** The hospital's own name from the server; quietly falls back to the product name. */
function HospitalName() {
  const hospital = useApiQuery(['hospital'], '/api/v1/hospital', hospitalInfoSchema);
  return (
    <AppText variant="subhead" numberOfLines={1}>
      {hospital.data?.name ?? 'HospitalOS'}
    </AppText>
  );
}

/**
 * Home tab. Signed-in accounts see their role's live figures from the API (LiveDashboard).
 * Synthetic figures appear only for a development demo session, always labelled DEMO DATA.
 * See `dashboard-content.ts`, `role-home.ts` and docs/MOBILE-ARCHITECTURE.md §6.1.
 */
export function HomeScreen() {
  const router = useRouter();
  const session = useSignedInSession();
  const role = primaryRole(session);
  const content = getDashboardContent(session);
  const isDemo = content.kind === 'demo';
  const modules = visibleModules(session);
  const signedIn = session.kind === 'authenticated';
  const actions = signedIn ? quickActionsFor(role?.code, session.permissions) : [];
  const now = new Date();
  const firstName = session.displayName.split(/\s+/)[0] ?? '';

  return (
    <ScreenContainer bottomInset={false}>
      <View style={styles.topBar}>
        <BrandMark />
        <View style={styles.brandText}>
          {signedIn ? (
            <HospitalName />
          ) : (
            <AppText variant="subhead" numberOfLines={1}>
              HospitalOS
            </AppText>
          )}
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {formatDateEyebrow(now)}
          </AppText>
        </View>
        <IconButton
          icon="inbox"
          accessibilityLabel="Open inbox"
          onPress={() => router.navigate('/inbox')}
        />
        <Pressable
          onPress={() => router.navigate('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          hitSlop={spacing.xs}
        >
          <Avatar name={session.displayName} ring />
        </Pressable>
      </View>

      <View style={styles.greeting}>
        <AppText variant="display" accessibilityRole="header">
          {greetingFor(now)}
          {firstName.length > 0 && firstName !== 'Demo' ? `, ${firstName}` : ''}
        </AppText>
        <View style={styles.roleRow}>
          <StatusChip
            label={role?.title ?? 'No role assigned'}
            tone="primary"
            dot={false}
            size="md"
          />
          <StatusChip
            label={isDemo ? 'DEVELOPMENT PREVIEW' : signedIn ? 'LIVE DATA' : 'NO LIVE DATA'}
            tone={isDemo ? 'warning' : signedIn ? 'success' : 'neutral'}
            dot={!isDemo}
            size="md"
          />
        </View>
      </View>

      {content.kind === 'demo' ? (
        <>
          <GlassCard tone="hero" padding="lg" enterIndex={0}>
            <AppText variant="overline" color="primary">
              DEVELOPMENT DEMO
            </AppText>
            <AppText variant="headline">{role ? `${role.summary}.` : 'No role assigned.'}</AppText>
            <AppText variant="bodySmall" color="textSecondary">
              Figures below are synthetic and exist only in development builds.
            </AppText>
          </GlassCard>
          <SectionHeader title="At a glance" meta="Today" />
          <View style={styles.demoBlock} testID="demo-figures">
            <DemoDataLabel />
            <View style={styles.metrics}>
              {content.dashboard.metrics.map((item, index) => (
                <MetricCard
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  caption={item.caption}
                  tone={item.tone}
                  enterIndex={index + 1}
                  style={styles.metricCard}
                />
              ))}
            </View>
          </View>
          <SectionHeader
            title="Priority tasks"
            action={{ label: 'View all', onPress: () => router.navigate('/queue') }}
          />
          <View style={styles.demoBlock} testID="demo-tasks">
            <DemoDataLabel />
            <GlassCard padding="none" elevation="low">
              <Divided>
                {content.dashboard.tasks.map((task, index) => (
                  <ListRow
                    key={task.title}
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
                ))}
              </Divided>
            </GlassCard>
          </View>
        </>
      ) : signedIn ? (
        <LiveDashboard role={role?.code} roleSummary={role?.summary ?? 'Your role'} />
      ) : (
        <GlassCard padding="none" elevation="low">
          <EmptyState
            icon="info"
            title="No live figures"
            message="Figures appear here for accounts signed in to the hospital server."
          />
        </GlassCard>
      )}

      {actions.length > 0 ? (
        <>
          <SectionHeader title="Quick actions" />
          <View style={styles.grid}>
            {actions.map((action) => (
              <PressableScale
                key={action.id}
                onPress={() => router.push(action.href)}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityHint={action.hint}
                style={styles.action}
              >
                <View style={styles.actionWell}>
                  <Icon name={action.icon} size={iconSize.md} color={colors.primary} />
                </View>
                <View style={styles.actionText}>
                  <AppText variant="label" numberOfLines={2}>
                    {action.label}
                  </AppText>
                  <AppText variant="caption" color="textMuted" numberOfLines={2}>
                    {action.hint}
                  </AppText>
                </View>
              </PressableScale>
            ))}
          </View>
        </>
      ) : null}

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
            <PressableScale
              key={module.id}
              onPress={() =>
                router.push({ pathname: '/modules/[moduleId]', params: { moduleId: module.id } })
              }
              accessibilityRole="button"
              accessibilityLabel={`${module.title} module`}
              style={styles.tile}
            >
              <View style={styles.well}>
                <Icon name={module.icon} size={iconSize.sm + 2} color={colors.secondary} />
              </View>
              <AppText variant="label" style={styles.tileLabel} numberOfLines={1}>
                {module.title}
              </AppText>
              <Icon name="chevron-right" size={iconSize.xs} color={colors.textMuted} />
            </PressableScale>
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
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brandText: { flex: 1, gap: spacing.xxs },
  greeting: { gap: spacing.md, marginTop: spacing.xs },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  demoBlock: { gap: spacing.sm },
  demoLabel: { alignSelf: 'flex-start' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricCard: { flexGrow: 1, flexBasis: '45%' },
  well: {
    width: layout.iconWell,
    height: layout.iconWell,
    borderRadius: radius.sm,
    backgroundColor: tints.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Two per row on phones, four on tablets: pure flex wrapping, no width measuring.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  action: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: layout.minTouchTarget + spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderTopColor: colors.borderHighlight,
    backgroundColor: colors.surfaceRaised,
  },
  actionWell: {
    width: layout.iconWell + spacing.xs,
    height: layout.iconWell + spacing.xs,
    borderRadius: radius.md,
    backgroundColor: tints.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1, gap: spacing.xxs },
  tile: {
    flexGrow: 1,
    flexBasis: layout.tileMinWidth,
    minHeight: layout.minTouchTarget + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: borders.thin,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
  },
  tileLabel: { flex: 1 },
  footer: { textAlign: 'center', marginTop: spacing.md },
});
