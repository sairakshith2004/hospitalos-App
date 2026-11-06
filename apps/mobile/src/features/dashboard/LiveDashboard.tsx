import { dashboardSchema, type RoleCode } from '@hospitalos/contracts';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  BarList,
  ChartCard,
  Divided,
  GlassCard,
  Icon,
  ListRow,
  LoadingSkeleton,
  MetricCard,
  QueryBoundary,
  SectionHeader,
  StackedBar,
  StatusChip,
  type BarDatum,
} from '@/components';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useApiQuery } from '@/services/api/hooks';
import { formatPaise } from '@/services/format';
import { colors, iconSize, layout, radius, spacing, tints } from '@/theme/tokens';

import { METRIC_STYLE, ROLE_HOME, TASK_ICON, type ChartSpec, type MetricLike } from './role-home';

type Props = { role: RoleCode | undefined; roleSummary: string };

function display(m: MetricLike): string {
  return m.unit === 'paise' ? formatPaise(m.value) : String(m.value);
}

/** Today's patient flow as parts of today's appointments; null when the figures don't add up. */
function flowParts(f: ReadonlyMap<string, MetricLike>): BarDatum[] | null {
  const total = f.get('appointments_today')?.value;
  const arrived = f.get('arrived_today')?.value;
  const waiting = f.get('waiting_now')?.value;
  if (total === undefined || arrived === undefined || waiting === undefined) return null;
  if (arrived > total || waiting > arrived) return null;
  const seen = arrived - waiting;
  const notYet = total - arrived;
  return [
    { key: 'waiting', label: 'Waiting', value: waiting, display: String(waiting) },
    { key: 'seen', label: 'Seen or in consultation', value: seen, display: String(seen) },
    { key: 'not-arrived', label: 'Not arrived', value: notYet, display: String(notYet) },
  ];
}

function Chart({
  spec,
  figures,
  index,
}: {
  spec: ChartSpec;
  figures: ReadonlyMap<string, MetricLike>;
  index: number;
}) {
  if (spec.kind === 'flow') {
    const flow = flowParts(figures);
    if (flow === null || (figures.get('appointments_today')?.value ?? 0) === 0) return null;
    return (
      <ChartCard
        title={spec.title}
        caption="Share of today's appointments · live"
        enterIndex={index}
      >
        <StackedBar parts={flow} />
      </ChartCard>
    );
  }
  const data = spec.keys.flatMap((key, i) => {
    const m = figures.get(key);
    return m === undefined
      ? []
      : [{ key, label: spec.labels[i] ?? key, value: m.value, display: display(m) }];
  });
  if (data.length !== spec.keys.length || data.length < 2) return null;
  // All zero: the KPI cards already say so; an empty chart adds nothing.
  if (data.every((d) => d.value === 0)) return null;
  return (
    <ChartCard
      title={spec.title}
      caption={spec.kind === 'money' ? 'Rupees · today · live' : 'Counts right now · live'}
      enterIndex={index}
    >
      <BarList data={data} />
    </ChartCard>
  );
}

/**
 * The signed-in role's Home figures, from GET /api/v1/dashboard (DB-1): an operational summary,
 * KPI cards, same-day charts and tasks. Loading, empty and error states come from the server
 * answer; nothing is invented.
 */
export function LiveDashboard({ role, roleSummary }: Props) {
  const query = useApiQuery(['dashboard'], '/api/v1/dashboard', dashboardSchema, {
    refetchInterval: 30_000,
  });
  const home = role ? ROLE_HOME[role] : undefined;
  const { isWide } = useResponsiveLayout();

  if (query.isPending) {
    return (
      <View style={styles.root}>
        <LoadingSkeleton variant="tiles" rows={4} accessibilityLabel="Loading today's figures" />
      </View>
    );
  }

  return (
    <QueryBoundary query={query} loadingLabel="Loading today's figures">
      {(data) => {
        const figures = new Map(data.metrics.map((m) => [m.key, m]));
        const summary = home?.summary(figures, formatPaise) ?? null;
        return (
          <View style={styles.root} testID="live-figures">
            <GlassCard tone="hero" padding="lg" enterIndex={0}>
              <View style={styles.heroTop}>
                <View style={styles.heroWell}>
                  <Icon
                    name={home?.heroIcon ?? 'pulse'}
                    size={iconSize.md}
                    color={colors.primary}
                  />
                </View>
                <AppText variant="overline" color="primary" style={styles.heroEyebrow}>
                  {home?.eyebrow ?? 'TODAY'}
                </AppText>
                {data.metrics.length > 0 ? <StatusChip label="LIVE" tone="success" /> : null}
              </View>
              <AppText variant="headline">{summary ?? 'No live figures for your role yet'}</AppText>
              <AppText variant="bodySmall" color="textSecondary">
                {summary === null
                  ? 'Your modules and their figures arrive in a later release. Nothing is shown until the hospital server provides it.'
                  : `${roleSummary}.`}
              </AppText>
            </GlassCard>

            {data.metrics.length > 0 ? (
              <>
                <SectionHeader title="At a glance" meta="Today" />
                <View style={styles.metrics}>
                  {data.metrics.map((m, index) => {
                    const style = METRIC_STYLE[m.key];
                    const share =
                      m.key === 'arrived_today' &&
                      (figures.get('appointments_today')?.value ?? 0) > 0
                        ? m.value / (figures.get('appointments_today')?.value ?? 1)
                        : undefined;
                    return (
                      <MetricCard
                        key={m.key}
                        label={m.label}
                        value={display(m)}
                        icon={style?.icon ?? 'analytics'}
                        tone={style?.tone ?? 'primary'}
                        {...(share !== undefined && share <= 1 ? { share } : {})}
                        enterIndex={index + 1}
                        style={
                          m.unit === 'paise'
                            ? isWide
                              ? styles.metricWideTablet
                              : styles.metricWide
                            : isWide
                              ? styles.metricTablet
                              : styles.metric
                        }
                      />
                    );
                  })}
                </View>
                {(home?.charts ?? []).map((spec, index) => (
                  <Chart key={spec.title} spec={spec} figures={figures} index={index + 2} />
                ))}
              </>
            ) : null}

            {data.tasks.length > 0 ? (
              <>
                <SectionHeader title="Needs attention" />
                <GlassCard padding="none" elevation="low" enterIndex={3}>
                  <Divided>
                    {data.tasks.map((task) => (
                      <ListRow
                        key={task.key}
                        title={task.title}
                        leading={
                          <View style={styles.taskWell}>
                            <Icon
                              name={TASK_ICON[task.key] ?? 'alert'}
                              size={iconSize.sm}
                              color={task.count > 0 ? colors.warning : colors.textMuted}
                            />
                          </View>
                        }
                        trailing={
                          <StatusChip
                            label={String(task.count)}
                            tone={task.count > 0 ? 'warning' : 'neutral'}
                            dot={false}
                          />
                        }
                      />
                    ))}
                  </Divided>
                </GlassCard>
              </>
            ) : null}
            <AppText variant="caption" color="textMuted">
              Figures for {data.date}, from the hospital server. Refreshes every 30 seconds.
            </AppText>
          </View>
        );
      }}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroWell: {
    width: layout.iconWell,
    height: layout.iconWell,
    borderRadius: radius.sm,
    backgroundColor: tints.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: { flex: 1 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { flexGrow: 1, flexBasis: '45%' },
  // Money keeps every paisa visible, so it gets the full row instead of shrinking.
  metricWide: { flexGrow: 1, flexBasis: '100%' },
  // Tablets: four counts or two amounts per row.
  metricTablet: { flexGrow: 1, flexBasis: '22%' },
  metricWideTablet: { flexGrow: 1, flexBasis: '45%' },
  taskWell: {
    width: layout.iconWell,
    height: layout.iconWell,
    borderRadius: radius.sm,
    backgroundColor: tints.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
