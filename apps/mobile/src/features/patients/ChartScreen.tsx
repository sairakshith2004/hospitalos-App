import { chartSchema, recordAllergyRequestSchema, z } from '@hospitalos/contracts';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  ListRow,
  PrimaryButton,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  StatusChip,
  SurfaceCard,
  TextField,
} from '@/components';
import { useSignedInSession } from '@/features/session/SessionProvider';
import { describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { hospitalTime } from '@/services/format';
import { spacing } from '@/theme/tokens';

/** The clinical chart. Every opening is audited by the server before any data is returned. */
export function ChartScreen({ id }: { id: string }) {
  const session = useSignedInSession();
  const chart = useApiQuery(['chart', id], `/api/v1/patients/${id}/chart`, chartSchema);
  const [substance, setSubstance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const addAllergy = useApiMutation(
    (body: { substance: string }) => ({ path: `/api/v1/patients/${id}/allergies`, body }),
    z.object({ id: z.string() }),
    [['chart', id]],
  );
  const canRecordAllergy = session.permissions.some((p) => p === 'allergy:record');

  return (
    <ScreenContainer>
      <ScreenHeader title="Chart" subtitle="Viewing is recorded in the audit log" back />
      <QueryBoundary query={chart} loadingLabel="Loading chart">
        {(c) => (
          <View style={styles.root}>
            <SurfaceCard>
              <AppText variant="headline">{`${c.patient.firstName} ${c.patient.lastName}`}</AppText>
              <AppText color="textSecondary">{`${c.patient.mrn} · ${c.patient.ageYears} y`}</AppText>
            </SurfaceCard>

            <SectionHeader title="Allergies" />
            <SurfaceCard>
              {c.allergies.length === 0 ? (
                <AppText color="textSecondary">No allergies recorded.</AppText>
              ) : null}
              {c.allergies.map((a) => (
                <ListRow
                  key={a.id}
                  title={a.substance}
                  {...(a.reaction !== null ? { subtitle: a.reaction } : {})}
                  trailing={
                    <StatusChip
                      label={a.severity}
                      tone={a.severity === 'severe' ? 'danger' : 'warning'}
                    />
                  }
                />
              ))}
              {canRecordAllergy ? (
                <View style={styles.inline}>
                  <TextField label="Add allergy" value={substance} onChangeText={setSubstance} />
                  <PrimaryButton
                    label="Record allergy"
                    disabled={!recordAllergyRequestSchema.safeParse({ substance }).success}
                    loading={addAllergy.isPending}
                    onPress={() =>
                      void addAllergy
                        .mutateAsync({ substance: substance.trim() })
                        .then(() => setSubstance(''))
                        .catch((e: unknown) => setError(describeError(e)))
                    }
                  />
                </View>
              ) : null}
              {error !== null ? (
                <Banner tone="danger" title="Not recorded" message={error} />
              ) : null}
            </SurfaceCard>

            <SectionHeader title="Vitals" />
            <SurfaceCard padding="none">
              {c.vitals.length === 0 ? <ListRow title="No vitals recorded" /> : null}
              {c.vitals.map((v) => (
                <ListRow
                  key={v.id}
                  title={[
                    v.tempC !== null ? `${v.tempC} °C` : null,
                    v.pulse !== null ? `pulse ${v.pulse}` : null,
                    v.bpSys !== null && v.bpDia !== null ? `BP ${v.bpSys}/${v.bpDia}` : null,
                    v.spo2 !== null ? `SpO₂ ${v.spo2}%` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  subtitle={`${hospitalTime(v.recordedAt)} · ${v.recordedBy}`}
                />
              ))}
            </SurfaceCard>

            {c.encounters.length > 0 ? <SectionHeader title="Consultations" /> : null}
            {c.encounters.map((e) => (
              <SurfaceCard key={e.id}>
                <AppText variant="label">{`${e.encounterNo} · ${e.status.replace(/_/g, ' ')}`}</AppText>
                {e.chiefComplaint !== null ? <AppText>{e.chiefComplaint}</AppText> : null}
                {e.diagnoses.map((d) => (
                  <AppText
                    key={d.id}
                    color="textSecondary"
                  >{`Diagnosis: ${d.description}${d.isPrimary ? ' (primary)' : ''}`}</AppText>
                ))}
                {e.notes.map((n) => (
                  <AppText
                    key={n.id}
                    color="textSecondary"
                  >{`${n.kind}: ${n.body} — ${n.author}`}</AppText>
                ))}
              </SurfaceCard>
            ))}

            {c.labResults.length > 0 ? <SectionHeader title="Verified lab results" /> : null}
            {c.labResults.map((l) => (
              <SurfaceCard key={l.orderId}>
                <AppText variant="label">{`${l.orderNo} · ${l.testName}`}</AppText>
                {l.results.map((r) => (
                  <AppText
                    key={r.parameter}
                    color={r.flag !== null && r.flag !== 'normal' ? 'warning' : 'textSecondary'}
                  >
                    {`${r.parameter}: ${r.value}${r.unit ? ` ${r.unit}` : ''}${r.flag !== null && r.flag !== 'normal' ? ` (${r.flag})` : ''}`}
                  </AppText>
                ))}
              </SurfaceCard>
            ))}
          </View>
        )}
      </QueryBoundary>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  inline: { gap: spacing.sm, marginTop: spacing.sm },
});
