import {
  patientSummarySchema,
  registerPatientRequestSchema,
  SEXES,
  z,
} from '@hospitalos/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Banner,
  ListRow,
  PrimaryButton,
  ScreenContainer,
  ScreenHeader,
  SecondaryButton,
  SurfaceCard,
  TextField,
} from '@/components';
import { useApi } from '@/features/session/SessionProvider';
import { ApiError, describeError } from '@/services/api/errors';
import {
  schemaFieldErrors,
  serverFieldErrors,
  type FieldMessages,
} from '@/services/api/form-errors';
import { humanize } from '@/services/format';
import { spacing } from '@/theme/tokens';

const candidatesSchema = z.object({
  candidates: z.array(
    z.object({
      id: z.string(),
      mrn: z.string(),
      name: z.string(),
      dob: z.string(),
      phone: z.string(),
      reason: z.string(),
    }),
  ),
});

/** Reception registers a patient (PR-1 to PR-4): possible duplicates are shown, never merged. */
export function RegisterPatientScreen() {
  const router = useRouter();
  const api = useApi();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    sex: 'female',
    phone: '',
    email: '',
    address: '',
  });
  const [fields, setFields] = useState<FieldMessages>({});
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<z.infer<typeof candidatesSchema>['candidates']>([]);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(confirmNotDuplicate: boolean) {
    const parsed = registerPatientRequestSchema.safeParse({
      ...form,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      confirmNotDuplicate,
    });
    setFields(schemaFieldErrors(parsed));
    if (!parsed.success) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetchRegister(parsed.data);
      router.replace({ pathname: '/patients/[id]', params: { id: response.id } });
    } catch (caught) {
      setFields(serverFieldErrors(caught));
      if (!(caught instanceof ApiError && caught.code === 'CONFLICT'))
        setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  /** A 409 carries the possible duplicates next to the error envelope. */
  async function fetchRegister(body: unknown) {
    try {
      return await api.request('/api/v1/patients', patientSummarySchema, { method: 'POST', body });
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'CONFLICT') {
        setDuplicates(candidatesSchema.safeParse(caught.body).data?.candidates ?? []);
      }
      throw caught;
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="Register patient" back />
      <SurfaceCard>
        <TextField
          label="First name"
          value={form.firstName}
          onChangeText={set('firstName')}
          errorText={fields.firstName}
        />
        <TextField
          label="Last name"
          value={form.lastName}
          onChangeText={set('lastName')}
          errorText={fields.lastName}
        />
        <TextField
          label="Date of birth"
          helperText="YYYY-MM-DD"
          value={form.dob}
          onChangeText={set('dob')}
          keyboardType="numbers-and-punctuation"
          errorText={fields.dob}
        />
        <View style={styles.row}>
          {SEXES.map((s) => (
            <SecondaryButton
              key={s}
              label={humanize(s)}
              disabled={form.sex === s}
              onPress={() => set('sex')(s)}
            />
          ))}
        </View>
        <TextField
          label="Mobile number"
          value={form.phone}
          onChangeText={(t) => set('phone')(t.replace(/\D/g, ''))}
          keyboardType="phone-pad"
          errorText={fields.phone}
        />
        <TextField
          label="Email (optional)"
          value={form.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          keyboardType="email-address"
          errorText={fields.email}
        />
        <TextField
          label="Address (optional)"
          value={form.address}
          onChangeText={set('address')}
          errorText={fields.address}
        />
        {error !== null ? <Banner tone="danger" title="Not registered" message={error} /> : null}
        <PrimaryButton
          label="Register"
          fullWidth
          loading={busy}
          onPress={() => void submit(false)}
        />
      </SurfaceCard>
      {duplicates.length > 0 ? (
        <SurfaceCard>
          <Banner
            tone="warning"
            title="This may be someone already registered"
            message="Open the existing record if it is the same person. Records are never merged automatically."
          />
          {duplicates.map((d) => (
            <ListRow
              key={d.id}
              title={`${d.name} · ${d.mrn}`}
              subtitle={`${d.dob} · ${d.phone} · ${humanize(d.reason)}`}
              onPress={() => router.replace({ pathname: '/patients/[id]', params: { id: d.id } })}
            />
          ))}
          <SecondaryButton
            label="It is a different person: register anyway"
            onPress={() => void submit(true)}
          />
        </SurfaceCard>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
