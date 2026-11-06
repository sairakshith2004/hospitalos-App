import { chartSchema, recordAllergyRequestSchema, z } from '@hospitalos/contracts';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  DataRow,
  Divided,
  EmptyState,
  GlassCard,
  Icon,
  ListRow,
  PatientCard,
  PrimaryButton,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  StatusChip,
  SurfaceCard,
  TextField,
  statusTone,
  type IconName,
} from '@/components';
import { useSignedInSession } from '@/features/session/SessionProvider';
import { describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { hospitalTime, humanize } from '@/services/format';
import { borders, colors, iconSize, layout, radius, spacing, tints } from '@/theme/tokens';

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
      <ScreenHeader
        title="Chart"
        eyebrow="CLINICAL"
        subtitle="Viewing is recorded in the audit log"
        back
      />
      <QueryBoundary query={chart} loadingLabel="Loading chart">
        {(c) => {
          const latest = c.vitals[0];
          return (
            <View style={styles.root}>
              <GlassCard tone="hero" padding="lg" enterIndex={0}>
                <PatientCard
                  size="header"
                  name={`${c.patient.firstName} ${c.patient.lastName}`}
                  mrn={c.patient.mrn}
                  meta={[`${c.patient.ageYears} y`]}
                  allergies={c.allergies.length}
                />
              </GlassCard>

              <SectionHeader title="Allergies" count={c.allergies.length} />
              <SurfaceCard padding="none" enterIndex={1}>
                {c.allergies.length === 0 ? (
                  <ListRow
                    title="No allergies recorded"
                    leading={<Icon name="check" size={iconSize.sm} color={colors.textMuted} />}
                  />
                ) : (
                  <Divided>
                    {c.allergies.map((a) => (
                      <ListRow
                        key={a.id}
                        title={a.substance}
                        {...(a.reaction !== null ? { subtitle: a.reaction } : {})}
                        leading={
                          <View style={styles.allergyWell}>
                            <Icon
                              name="warning"
                              size={iconSize.sm}
                              color={a.severity === 'severe' ? colors.danger : colors.warning}
                            />
                          </View>
                        }
                        trailing={
                          <StatusChip
                            label={humanize(a.severity)}
                            tone={a.severity === 'severe' ? 'danger' : 'warning'}
                          />
                        }
                      />
                    ))}
                  </Divided>
                )}
                {canRecordAllergy ? (
                  <View style={styles.form}>
                    <TextField label="Add allergy" value={substance} onChangeText={setSubstance} />
                    <PrimaryButton
                      label="Record allergy"
                      fullWidth
                      disabled={!recordAllergyRequestSchema.safeParse({ substance }).success}
                      loading={addAllergy.isPending}
                      onPress={() =>
                        void addAllergy
                          .mutateAsync({ substance: substance.trim() })
                          .then(() => setSubstance(''))
                          .catch((e: unknown) => setError(describeError(e)))
                      }
                    />
                    {error !== null ? (
                      <Banner tone="danger" title="Not recorded" message={error} />
                    ) : null}
                  </View>
                ) : null}
              </SurfaceCard>

              <SectionHeader
                title="Vitals"
                {...(latest !== undefined
                  ? { meta: `Latest ${hospitalTime(latest.recordedAt)} · ${latest.recordedBy}` }
                  : {})}
              />
              {latest === undefined ? (
                <SurfaceCard padding="none">
                  <EmptyState icon="pulse" title="No vitals recorded" />
                </SurfaceCard>
              ) : (
                <View style={styles.vitals}>
                  <VitalTile
                    icon="thermometer"
                    label="Temperature"
                    value={latest.tempC}
                    unit="°C"
                  />
                  <VitalTile icon="heart" label="Pulse" value={latest.pulse} unit="/min" />
                  <VitalTile
                    icon="fitness"
                    label="Blood pressure"
                    value={
                      latest.bpSys !== null && latest.bpDia !== null
                        ? `${latest.bpSys}/${latest.bpDia}`
                        : null
                    }
                    unit="mmHg"
                  />
                  <VitalTile icon="water" label="SpO₂" value={latest.spo2} unit="%" />
                </View>
              )}
              {c.vitals.length > 1 ? (
                <SurfaceCard padding="none">
                  <Divided>
                    {c.vitals.slice(1).map((v) => (
                      <ListRow
                        key={v.id}
                        title={[
                          v.tempC !== null ? `${v.tempC} °C` : null,
                          v.pulse !== null ? `pulse ${v.pulse}` : null,
                          v.bpSys !== null && v.bpDia !== null ? `BP ${v.bpSys}/${v.bpDia}` : null,
                          v.spo2 !== null ? `SpO₂ ${v.spo2}%` : null,
                        ]
                          .filter(Boolean)
                          .join('  ·  ')}
                        subtitle={`${hospitalTime(v.recordedAt)}  ·  ${v.recordedBy}`}
                      />
                    ))}
                  </Divided>
                </SurfaceCard>
              ) : null}

              {c.encounters.length > 0 ? (
                <SectionHeader title="Consultations" count={c.encounters.length} />
              ) : null}
              {c.encounters.map((e) => (
                <SurfaceCard key={e.id} padding="md">
                  <View style={styles.encHead}>
                    <AppText variant="subhead" style={styles.flex}>
                      {e.encounterNo}
                    </AppText>
                    <StatusChip label={humanize(e.status)} tone={statusTone(e.status)} />
                  </View>
                  {e.chiefComplaint !== null ? (
                    <AppText variant="body">{e.chiefComplaint}</AppText>
                  ) : null}
                  {e.diagnoses.map((d) => (
                    <View key={d.id} style={styles.dx}>
                      <AppText variant="label" color="secondary">
                        DIAGNOSIS
                      </AppText>
                      <AppText variant="bodySmall" style={styles.flex}>
                        {d.description}
                      </AppText>
                      {d.isPrimary ? (
                        <StatusChip label="Primary" tone="secondary" dot={false} />
                      ) : null}
                    </View>
                  ))}
                  {e.notes.map((n) => (
                    <View key={n.id} style={styles.note}>
                      <AppText variant="overline" color="textMuted">
                        {humanize(n.kind).toUpperCase()}
                      </AppText>
                      <AppText variant="bodySmall" color="textSecondary">
                        {`${n.body} — ${n.author}`}
                      </AppText>
                    </View>
                  ))}
                </SurfaceCard>
              ))}

              {c.labResults.length > 0 ? <SectionHeader title="Verified lab results" /> : null}
              {c.labResults.map((l) => (
                <SurfaceCard key={l.orderId} padding="md">
                  <View style={styles.encHead}>
                    <AppText variant="subhead" style={styles.flex}>
                      {l.testName}
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      {l.orderNo}
                    </AppText>
                  </View>
                  {l.results.map((r) => {
                    const flagged = r.flag !== null && r.flag !== 'normal';
                    return (
                      <DataRow
                        key={r.parameter}
                        label={`${r.parameter}${flagged ? ` (${r.flag ?? ''})` : ''}`}
                        value={`${r.value}${r.unit ? ` ${r.unit}` : ''}`}
                        valueColor={flagged ? 'warning' : 'text'}
                      />
                    );
                  })}
                </SurfaceCard>
              ))}
            </View>
          );
        }}
      </QueryBoundary>
    </ScreenContainer>
  );
}

/** One vital sign as a readable tile: icon, value with unit, label. Missing values show "—". */
function VitalTile({
  icon,
  label,
  value,
  unit,
}: {
  icon: IconName;
  label: string;
  value: number | string | null;
  unit: string;
}) {
  const shown = value === null ? '—' : String(value);
  return (
    <View
      style={styles.vital}
      accessible
      accessibilityLabel={`${label}, ${value === null ? 'not recorded' : `${shown} ${unit}`}`}
    >
      <Icon name={icon} size={iconSize.sm} color={colors.primary} />
      <View style={styles.vitalValue}>
        <AppText variant="figureLarge">{shown}</AppText>
        {value !== null ? (
          <AppText variant="caption" color="textMuted">
            {unit}
          </AppText>
        ) : null}
      </View>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  form: { gap: spacing.sm, padding: spacing.lg },
  allergyWell: {
    width: layout.iconWell,
    height: layout.iconWell,
    borderRadius: radius.sm,
    backgroundColor: tints.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  vital: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderTopColor: colors.borderHighlight,
    backgroundColor: colors.surfaceStrong,
  },
  vitalValue: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  encHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  dx: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  note: { gap: spacing.xxs },
});
