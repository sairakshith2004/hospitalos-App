import {
  appointmentSchema,
  availabilitySchema,
  doctorListSchema,
  hospitalInfoSchema,
} from '@hospitalos/contracts';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  ChoiceGroup,
  DataRow,
  DoctorCard,
  EmptyState,
  GlassCard,
  PrimaryButton,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  SurfaceCard,
} from '@/components';
import { ApiError, describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { formatPaise, hospitalTime } from '@/services/format';
import { spacing } from '@/theme/tokens';

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Book: doctor → day → free slot (only free slots are offered; the server has the final word). */
export function BookScreen({
  patientId,
  followUpId,
}: {
  patientId: string;
  followUpId?: string | undefined;
}) {
  const router = useRouter();
  const hospital = useApiQuery(['hospital'], '/api/v1/hospital', hospitalInfoSchema);
  const doctors = useApiQuery(['doctors'], '/api/v1/doctors', doctorListSchema);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const date = hospital.data ? addDays(hospital.data.today, offset) : null;
  const availability = useApiQuery(
    ['availability', doctorId, date],
    doctorId !== null && date !== null
      ? `/api/v1/doctors/${doctorId}/availability?date=${date}`
      : null,
    availabilitySchema,
  );
  const book = useApiMutation(
    (slotStart: string) => ({
      path: '/api/v1/appointments',
      body: { patientId, doctorId, slotStart, ...(followUpId ? { followUpId } : {}) },
      idempotent: true,
    }),
    appointmentSchema,
    [['appointments'], ['availability'], ['follow-ups'], ['dashboard']],
  );
  const days = useMemo(() => [0, 1, 2, 3, 4, 5, 6], []);

  const chosenDoctor = doctors.data?.items.find((d) => d.id === doctorId);

  return (
    <ScreenContainer>
      <ScreenHeader
        title={followUpId ? 'Book follow-up' : 'Book appointment'}
        eyebrow="RECEPTION"
        back
      />
      <SectionHeader title="1. Doctor" />
      <QueryBoundary query={doctors} loadingLabel="Loading doctors">
        {(d) =>
          d.items.length === 0 ? (
            <SurfaceCard padding="none">
              <EmptyState icon="people" title="No doctors available" />
            </SurfaceCard>
          ) : (
            <SurfaceCard padding="sm" enterIndex={0}>
              <View accessibilityRole="radiogroup" accessibilityLabel="Doctor" style={styles.list}>
                {d.items.map((doc) => (
                  <DoctorCard
                    key={doc.id}
                    name={doc.fullName}
                    department={doc.departmentName}
                    specialty={doc.specialty}
                    fee={formatPaise(doc.consultationFeePaise)}
                    selected={doctorId === doc.id}
                    onPress={() => {
                      setDoctorId(doc.id);
                      setSlot(null);
                    }}
                  />
                ))}
              </View>
            </SurfaceCard>
          )
        }
      </QueryBoundary>

      {doctorId !== null && date !== null ? (
        <>
          <SectionHeader title="2. Day" meta={date} />
          <ChoiceGroup
            label="Day"
            value={String(offset)}
            onChange={(v) => {
              setOffset(Number(v));
              setSlot(null);
            }}
            options={days.map((d) => ({
              value: String(d),
              label: d === 0 ? 'Today' : addDays(hospital.data?.today ?? '', d).slice(5),
            }))}
          />
          <SectionHeader title="3. Time" />
          <QueryBoundary query={availability} loadingLabel="Loading free slots">
            {(a) =>
              a.slots.length === 0 ? (
                <SurfaceCard padding="none">
                  <EmptyState
                    icon="time"
                    title="No free slots that day"
                    message="Choose another day or another doctor."
                  />
                </SurfaceCard>
              ) : (
                <ChoiceGroup
                  label="Time"
                  value={slot}
                  onChange={setSlot}
                  options={a.slots
                    .slice(0, 48)
                    .map((s) => ({ value: s.start, label: hospitalTime(s.start) }))}
                />
              )
            }
          </QueryBoundary>
        </>
      ) : null}

      {error !== null ? <Banner tone="danger" title="Not booked" message={error} /> : null}
      {slot !== null && chosenDoctor !== undefined ? (
        <GlassCard tone="hero" padding="md">
          <AppText variant="overline" color="primary">
            SUMMARY
          </AppText>
          <DataRow label="Doctor" value={chosenDoctor.fullName} />
          <DataRow label="When" value={`${date ?? ''}  ${hospitalTime(slot)}`} />
          <DataRow
            label="Consultation fee"
            value={formatPaise(chosenDoctor.consultationFeePaise)}
          />
        </GlassCard>
      ) : null}
      <PrimaryButton
        label={slot ? `Book ${hospitalTime(slot)} on ${date ?? ''}` : 'Choose a slot'}
        fullWidth
        size="lg"
        disabled={slot === null}
        loading={book.isPending}
        onPress={() =>
          slot !== null &&
          void book
            .mutateAsync(slot)
            .then(() => router.back())
            .catch((e: unknown) => {
              setError(
                e instanceof ApiError && e.code === 'SLOT_UNAVAILABLE'
                  ? 'That slot was just taken. Choose another.'
                  : describeError(e),
              );
              setSlot(null);
              void availability.refetch();
            })
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
});
