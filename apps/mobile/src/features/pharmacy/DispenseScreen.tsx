import { dispensingSchema, prescriptionSchema } from '@hospitalos/contracts';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  ChoiceChip,
  DataRow,
  GlassCard,
  Icon,
  PatientCard,
  PrimaryButton,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  StatusChip,
  statusTone,
  SurfaceCard,
  TextField,
} from '@/components';
import { ApiError, describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { humanize } from '@/services/format';
import { colors, iconSize, layout, radius, spacing, tints } from '@/theme/tokens';

/**
 * Dispensing: the server picks batches first-expiry-first-out and never uses expired or recalled
 * stock. One Idempotency-Key per attempt, so a double tap or a retry can't dispense twice.
 */
export function DispenseScreen({ id }: { id: string }) {
  const rx = useApiQuery(['prescription', id], `/api/v1/prescriptions/${id}`, prescriptionSchema);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [acknowledge, setAcknowledge] = useState(false);
  const [message, setMessage] = useState<{
    tone: 'success' | 'danger' | 'warning';
    title: string;
    text: string;
  } | null>(null);
  const dispense = useApiMutation(
    (lines: unknown) => ({
      path: `/api/v1/prescriptions/${id}/dispense`,
      body: { lines },
      idempotent: true,
    }),
    dispensingSchema,
    [['prescription', id], ['prescriptions'], ['dashboard']],
  );

  return (
    <ScreenContainer>
      <ScreenHeader title="Dispense" eyebrow="PHARMACY" back />
      {message !== null ? (
        <Banner tone={message.tone} title={message.title} message={message.text} />
      ) : null}
      <QueryBoundary query={rx} loadingLabel="Loading prescription">
        {(p) => {
          const remaining = p.items.filter((i) => i.qtyDispensed < i.qtyPrescribed);
          const lines = remaining
            .map((i) => ({
              prescriptionItemId: i.id,
              qty: Number(qty[i.id] ?? i.qtyPrescribed - i.qtyDispensed),
              acknowledgeNearExpiry: acknowledge,
            }))
            .filter((l) => l.qty > 0);
          return (
            <View style={styles.root}>
              <GlassCard tone="hero" padding="lg" enterIndex={0}>
                <PatientCard
                  size="header"
                  name={p.patient.name}
                  mrn={p.patient.mrn}
                  allergies={p.allergies.length}
                  meta={[p.rxNo, p.doctorName]}
                />
                <View style={styles.rxMeta}>
                  <StatusChip
                    label={p.expired ? 'Expired' : humanize(p.status)}
                    tone={p.expired ? 'danger' : statusTone(p.status)}
                    size="md"
                  />
                  <AppText variant="caption" color="textMuted">
                    {`Valid until ${p.validUntil}`}
                  </AppText>
                </View>
                {p.allergies.length > 0 ? (
                  <Banner
                    tone="danger"
                    icon="warning"
                    title="Allergies"
                    message={p.allergies.map((a) => `${a.substance} (${a.severity})`).join(', ')}
                  />
                ) : null}
              </GlassCard>
              <SectionHeader title="Medicines" count={p.items.length} />
              {p.items.map((i, index) => (
                <SurfaceCard key={i.id} enterIndex={index + 1}>
                  <View style={styles.medHead}>
                    <View style={styles.medWell}>
                      <Icon name="medkit" size={iconSize.sm} color={colors.primary} />
                    </View>
                    <View style={styles.medText}>
                      <AppText variant="subhead">{i.medicineName}</AppText>
                      <AppText
                        variant="bodySmall"
                        color="textSecondary"
                      >{`${i.dose}  ·  ${i.frequency}  ·  ${i.route}${i.durationDays ? `  ·  ${i.durationDays} days` : ''}`}</AppText>
                    </View>
                  </View>
                  <DataRow label="Prescribed" value={String(i.qtyPrescribed)} />
                  <DataRow
                    label="Dispensed so far"
                    value={String(i.qtyDispensed)}
                    valueColor={i.qtyDispensed >= i.qtyPrescribed ? 'success' : 'text'}
                  />
                  {i.substitutionAllowed ? (
                    <StatusChip label="Substitution allowed" tone="info" dot={false} />
                  ) : null}
                  {i.allergyAcknowledged ? (
                    <StatusChip label="Doctor acknowledged an allergy match" tone="warning" />
                  ) : null}
                  {i.qtyDispensed < i.qtyPrescribed ? (
                    <TextField
                      label="Quantity to dispense now"
                      keyboardType="number-pad"
                      value={qty[i.id] ?? String(i.qtyPrescribed - i.qtyDispensed)}
                      onChangeText={(t) => setQty((q) => ({ ...q, [i.id]: t.replace(/\D/g, '') }))}
                    />
                  ) : null}
                </SurfaceCard>
              ))}
              {remaining.length > 0 && !p.expired ? (
                <>
                  <ChoiceChip
                    role="checkbox"
                    label="Accept near-expiry stock if it is the first to expire"
                    selected={acknowledge}
                    onPress={() => setAcknowledge((v) => !v)}
                  />
                  <AppText variant="caption" color="textMuted">
                    Batches are chosen first-expiry-first-out by the server. Expired, recalled and
                    quarantined stock is never dispensed.
                  </AppText>
                  <PrimaryButton
                    label="Dispense"
                    fullWidth
                    size="lg"
                    disabled={lines.length === 0}
                    loading={dispense.isPending}
                    onPress={() =>
                      void dispense
                        .mutateAsync(lines)
                        .then((d) =>
                          setMessage({
                            tone: 'success',
                            title: `Dispensed (${d.dispenseNo})`,
                            text: d.lines
                              .map(
                                (l) =>
                                  `${l.qty} from batch ${l.batchNo}${l.expiryDate ? ` (exp ${l.expiryDate})` : ''}`,
                              )
                              .join('; '),
                          }),
                        )
                        .catch((e: unknown) =>
                          setMessage({
                            tone:
                              e instanceof ApiError && e.code === 'UNPROCESSABLE'
                                ? 'warning'
                                : 'danger',
                            title: 'Not dispensed',
                            text: describeError(e),
                          }),
                        )
                    }
                  />
                </>
              ) : null}
            </View>
          );
        }}
      </QueryBoundary>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  rxMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  medHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  medWell: {
    width: layout.iconWell,
    height: layout.iconWell,
    borderRadius: radius.sm,
    backgroundColor: tints.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medText: { flex: 1, gap: spacing.xxs },
});
