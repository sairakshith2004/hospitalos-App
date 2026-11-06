import { dashboardSchema } from '@hospitalos/contracts';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  EmptyState,
  GlassCard,
  ListRow,
  MetricCard,
  QueryBoundary,
  StatusChip,
} from '@/components';
import { useApiQuery } from '@/services/api/hooks';
import { formatPaise } from '@/services/format';
import { colors, spacing, borders } from '@/theme/tokens';

/** Home figures and tasks for a signed-in account, from GET /api/v1/dashboard (DB-1). */
export function LiveDashboard() {
  const query = useApiQuery(['dashboard'], '/api/v1/dashboard', dashboardSchema, {
    refetchInterval: 30_000,
  });
  return (
    <QueryBoundary query={query} loadingLabel="Loading today's figures">
      {(data) => (
        <View style={styles.root} testID="live-figures">
          {data.metrics.length === 0 ? (
            <GlassCard padding="none" elevation="low">
              <EmptyState
                icon="info"
                title="No figures for your role yet"
                message="Your modules arrive in a later release."
              />
            </GlassCard>
          ) : (
            <View style={styles.metrics}>
              {data.metrics.map((m) => (
                <MetricCard
                  key={m.key}
                  label={m.label}
                  value={m.unit === 'paise' ? formatPaise(m.value) : String(m.value)}
                  style={styles.metric}
                />
              ))}
            </View>
          )}
          {data.tasks.length > 0 ? (
            <GlassCard padding="none" elevation="low">
              {data.tasks.map((task, index) => (
                <View key={task.key} style={index > 0 && styles.divider}>
                  <ListRow
                    title={task.title}
                    trailing={
                      <StatusChip
                        label={String(task.count)}
                        tone={task.count > 0 ? 'warning' : 'neutral'}
                        dot={false}
                      />
                    }
                  />
                </View>
              ))}
            </GlassCard>
          ) : null}
          <AppText variant="caption" color="textMuted">
            Figures for {data.date}, from the hospital server.
          </AppText>
        </View>
      )}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { flexGrow: 1, flexBasis: '45%' },
  divider: { borderTopWidth: borders.hairline, borderTopColor: colors.border },
});
