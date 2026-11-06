import { vitalsRequestSchema, z } from '@hospitalos/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import {
  Banner,
  PrimaryButton,
  ScreenContainer,
  ScreenHeader,
  SurfaceCard,
  TextField,
} from '@/components';
import { describeError } from '@/services/api/errors';
import { schemaFieldErrors, type FieldMessages } from '@/services/api/form-errors';
import { useApiMutation } from '@/services/api/hooks';

const FIELDS = [
  ['tempC', 'Temperature (°C)'],
  ['pulse', 'Pulse (per minute)'],
  ['bpSys', 'Blood pressure: systolic'],
  ['bpDia', 'Blood pressure: diastolic'],
  ['respRate', 'Respiratory rate'],
  ['spo2', 'SpO₂ (%)'],
  ['weightKg', 'Weight (kg)'],
  ['heightCm', 'Height (cm)'],
] as const;

/** Vitals for a checked-in patient: the doctor, or a nurse assigned to today's session. */
export function VitalsScreen({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<FieldMessages>({});
  const [error, setError] = useState<string | null>(null);
  const save = useApiMutation(
    (body: unknown) => ({ path: '/api/v1/vitals', body }),
    z.object({ id: z.string() }),
    [['chart'], ['queue']],
  );

  function submit() {
    const numbers = Object.fromEntries(
      Object.entries(values)
        .filter(([, v]) => v.trim() !== '')
        .map(([k, v]) => [k, Number(v)]),
    );
    const parsed = vitalsRequestSchema.safeParse({ appointmentId, ...numbers });
    setFields(schemaFieldErrors(parsed));
    if (!parsed.success) return;
    void save
      .mutateAsync(parsed.data)
      .then(() => router.back())
      .catch((e: unknown) => setError(describeError(e)));
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="Record vitals" back />
      <SurfaceCard>
        {FIELDS.map(([key, label]) => (
          <TextField
            key={key}
            label={label}
            value={values[key] ?? ''}
            keyboardType="decimal-pad"
            onChangeText={(text) =>
              setValues((v) => ({ ...v, [key]: text.replace(/[^0-9.]/g, '') }))
            }
            errorText={fields[key]}
          />
        ))}
        {error !== null ? <Banner tone="danger" title="Not saved" message={error} /> : null}
        <PrimaryButton label="Save vitals" fullWidth loading={save.isPending} onPress={submit} />
      </SurfaceCard>
    </ScreenContainer>
  );
}
