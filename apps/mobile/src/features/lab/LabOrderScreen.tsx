import { labOrderSchema } from '@hospitalos/contracts';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  DataRow,
  GlassCard,
  PatientCard,
  PrimaryButton,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  StatusChip,
  statusTone,
  SurfaceCard,
  TextField,
} from '@/components';
import { useSignedInSession } from '@/features/session/SessionProvider';
import { describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { humanize } from '@/services/format';
import { colors, radius, spacing, tints } from '@/theme/tokens';

/** One lab order through collection, processing, results and independent verification. */
const STAGES = [
  { key: 'ordered', label: 'Collect' },
  { key: 'sample_collected', label: 'Process' },
  { key: 'in_process', label: 'Results' },
  { key: 'resulted', label: 'Verify' },
] as const;

/** Where the order is in the laboratory steps. Text labels carry the meaning; colour supports it. */
function Stages({ status }: { status: string }) {
  const done = status === 'verified';
  const current = STAGES.findIndex((stage) => stage.key === status);
  return (
    <View
      style={styles.stages}
      accessible
      accessibilityLabel={
        done
          ? 'All steps done'
          : current >= 0
            ? `Next step: ${STAGES[current]?.label ?? ''}`
            : humanize(status)
      }
    >
      {STAGES.map((stage, index) => {
        const complete = done || (current >= 0 && index < current);
        const active = !done && index === current;
        return (
          <View key={stage.key} style={styles.stage}>
            <View style={[styles.bar, complete && styles.barDone, active && styles.barActive]} />
            <AppText
              variant="caption"
              color={active ? 'primary' : complete ? 'success' : 'textMuted'}
            >
              {stage.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

export function LabOrderScreen({ id }: { id: string }) {
  const session = useSignedInSession();
  const order = useApiQuery(['lab-order', id], `/api/v1/lab-orders/${id}`, labOrderSchema);
  const [barcode, setBarcode] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const refresh = [['lab-order', id], ['lab-orders'], ['dashboard']] as const;
  const collect = useApiMutation(
    (body: unknown) => ({ path: `/api/v1/lab-orders/${id}/collect`, body }),
    labOrderSchema,
    refresh,
  );
  const process = useApiMutation(
    (body: unknown) => ({ path: `/api/v1/lab-orders/${id}/process`, body }),
    labOrderSchema,
    refresh,
  );
  const results = useApiMutation(
    (body: unknown) => ({ path: `/api/v1/lab-orders/${id}/results`, body }),
    labOrderSchema,
    refresh,
  );
  const verify = useApiMutation(
    (body: unknown) => ({ path: `/api/v1/lab-orders/${id}/verify`, body }),
    labOrderSchema,
    refresh,
  );
  const fail = (e: unknown) => setError(describeError(e));
  const userId = session.kind === 'authenticated' ? session.userId : null;

  return (
    <ScreenContainer>
      <ScreenHeader title="Lab order" eyebrow="LABORATORY" back />
      {error !== null ? <Banner tone="danger" title="Not done" message={error} /> : null}
      <QueryBoundary query={order} loadingLabel="Loading order">
        {(o) => (
          <View style={styles.root}>
            <GlassCard tone="hero" padding="lg" enterIndex={0}>
              <View style={styles.head}>
                <View style={styles.flex}>
                  <AppText variant="overline" color="secondary">
                    {o.orderNo}
                  </AppText>
                  <AppText variant="title">{o.test.name}</AppText>
                </View>
                <StatusChip label={humanize(o.status)} tone={statusTone(o.status)} size="md" />
              </View>
              <PatientCard
                flush
                name={o.patient.name}
                mrn={o.patient.mrn}
                meta={[humanize(o.test.sampleType)]}
              />
              {o.sampleBarcode !== null ? (
                <DataRow label="Sample barcode" value={o.sampleBarcode} />
              ) : null}
              <Stages status={o.status} />
            </GlassCard>

            {o.status === 'ordered' ? (
              <SurfaceCard>
                <TextField
                  label="Sample barcode"
                  helperText="Scan or type the tube label"
                  value={barcode}
                  onChangeText={setBarcode}
                  autoCapitalize="characters"
                />
                <PrimaryButton
                  label="Sample collected"
                  fullWidth
                  disabled={barcode.trim().length < 4}
                  loading={collect.isPending}
                  onPress={() =>
                    void collect
                      .mutateAsync({ barcode: barcode.trim() })
                      .then(() => setError(null))
                      .catch(fail)
                  }
                />
              </SurfaceCard>
            ) : null}

            {o.status === 'sample_collected' ? (
              <PrimaryButton
                label="Start processing"
                fullWidth
                size="lg"
                loading={process.isPending}
                onPress={() =>
                  void process
                    .mutateAsync({})
                    .then(() => setError(null))
                    .catch(fail)
                }
              />
            ) : null}

            {o.status === 'in_process' ? (
              <SurfaceCard>
                {o.results.map((r) => (
                  <TextField
                    key={r.parameterId}
                    label={`${r.parameter}${r.unit ? ` (${r.unit})` : ''}`}
                    helperText={
                      r.refLow !== null || r.refHigh !== null
                        ? `Reference ${r.refLow ?? '–'} to ${r.refHigh ?? '–'}`
                        : undefined
                    }
                    keyboardType="decimal-pad"
                    value={values[r.parameterId] ?? ''}
                    onChangeText={(t) =>
                      setValues((v) => ({ ...v, [r.parameterId]: t.replace(/[^0-9.]/g, '') }))
                    }
                  />
                ))}
                <PrimaryButton
                  label="Save results"
                  fullWidth
                  disabled={o.results.some((r) => !(values[r.parameterId] ?? '').trim())}
                  loading={results.isPending}
                  onPress={() =>
                    void results
                      .mutateAsync({
                        results: o.results.map((r) => ({
                          parameterId: r.parameterId,
                          valueNum: Number(values[r.parameterId]),
                        })),
                      })
                      .then(() => setError(null))
                      .catch(fail)
                  }
                />
              </SurfaceCard>
            ) : null}

            {o.status === 'resulted' || o.status === 'verified' ? (
              <SurfaceCard padding="lg">
                <AppText variant="overline" color="textMuted">
                  RESULTS
                </AppText>
                {o.results.map((r) => {
                  const flagged = r.flag !== null && r.flag !== 'normal';
                  return (
                    <DataRow
                      key={r.parameterId}
                      label={`${r.parameter}${r.flag !== null ? ` (${r.flag})` : ''}`}
                      value={`${r.valueNum ?? r.valueText ?? ''}${r.unit ? ` ${r.unit}` : ''}`}
                      valueColor={flagged ? 'warning' : 'text'}
                    />
                  );
                })}
                {o.status === 'resulted' ? (
                  o.resultedBy === userId ? (
                    <Banner
                      tone="neutral"
                      title="Waiting for verification"
                      message="Another technician verifies the results you entered."
                    />
                  ) : (
                    <PrimaryButton
                      label="Verify results"
                      loading={verify.isPending}
                      onPress={() =>
                        void verify
                          .mutateAsync({})
                          .then(() => setError(null))
                          .catch(fail)
                      }
                    />
                  )
                ) : null}
              </SurfaceCard>
            ) : null}
          </View>
        )}
      </QueryBoundary>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs },
  stages: { flexDirection: 'row', gap: spacing.xs },
  stage: { flex: 1, gap: spacing.xs },
  bar: { height: spacing.xs, borderRadius: radius.pill, backgroundColor: tints.neutral },
  barDone: { backgroundColor: colors.success },
  barActive: { backgroundColor: colors.primary },
});
