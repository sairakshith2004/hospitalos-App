import { labOrderSchema } from '@hospitalos/contracts';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  PrimaryButton,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  StatusChip,
  SurfaceCard,
  TextField,
} from '@/components';
import { useSignedInSession } from '@/features/session/SessionProvider';
import { describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { humanize } from '@/services/format';
import { spacing } from '@/theme/tokens';

/** One lab order through collection, processing, results and independent verification. */
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
      <ScreenHeader title="Lab order" back />
      {error !== null ? <Banner tone="danger" title="Not done" message={error} /> : null}
      <QueryBoundary query={order} loadingLabel="Loading order">
        {(o) => (
          <View style={styles.root}>
            <SurfaceCard>
              <AppText variant="headline">{`${o.orderNo} · ${o.test.name}`}</AppText>
              <AppText color="textSecondary">{`${o.patient.name} · ${o.patient.mrn} · ${o.test.sampleType}`}</AppText>
              <StatusChip label={humanize(o.status)} tone="primary" />
              {o.sampleBarcode !== null ? <AppText>{`Sample ${o.sampleBarcode}`}</AppText> : null}
            </SurfaceCard>

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
              <SurfaceCard>
                {o.results.map((r) => (
                  <AppText
                    key={r.parameterId}
                    color={r.flag !== null && r.flag !== 'normal' ? 'warning' : 'text'}
                  >
                    {`${r.parameter}: ${r.valueNum ?? r.valueText ?? ''}${r.unit ? ` ${r.unit}` : ''}${r.flag !== null ? ` · ${r.flag}` : ''}`}
                  </AppText>
                ))}
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

const styles = StyleSheet.create({ root: { gap: spacing.md } });
