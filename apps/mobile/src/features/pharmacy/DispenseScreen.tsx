import { dispensingSchema, prescriptionSchema } from '@hospitalos/contracts';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  PrimaryButton,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SecondaryButton,
  StatusChip,
  SurfaceCard,
  TextField,
} from '@/components';
import { ApiError, describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { humanize } from '@/services/format';
import { spacing } from '@/theme/tokens';

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
      <ScreenHeader title="Dispense" back />
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
              <SurfaceCard>
                <AppText variant="headline">{`${p.rxNo} · ${p.patient.name}`}</AppText>
                <AppText color="textSecondary">{`${p.patient.mrn} · ${p.doctorName} · valid until ${p.validUntil}`}</AppText>
                <StatusChip
                  label={p.expired ? 'Expired' : humanize(p.status)}
                  tone={p.expired ? 'danger' : 'primary'}
                />
                {p.allergies.length > 0 ? (
                  <Banner
                    tone="danger"
                    title="Allergies"
                    message={p.allergies.map((a) => `${a.substance} (${a.severity})`).join(', ')}
                  />
                ) : null}
              </SurfaceCard>
              {p.items.map((i) => (
                <SurfaceCard key={i.id}>
                  <AppText variant="label">{i.medicineName}</AppText>
                  <AppText color="textSecondary">{`${i.dose} · ${i.frequency} · ${i.route}${i.durationDays ? ` · ${i.durationDays} days` : ''}`}</AppText>
                  <AppText>{`Dispensed ${i.qtyDispensed} of ${i.qtyPrescribed}${i.substitutionAllowed ? ' · substitution allowed' : ''}`}</AppText>
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
                  <SecondaryButton
                    label={
                      acknowledge
                        ? 'Near-expiry stock confirmed ✓'
                        : 'Confirm near-expiry stock if offered'
                    }
                    onPress={() => setAcknowledge((v) => !v)}
                  />
                  <PrimaryButton
                    label="Dispense"
                    fullWidth
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

const styles = StyleSheet.create({ root: { gap: spacing.md } });
