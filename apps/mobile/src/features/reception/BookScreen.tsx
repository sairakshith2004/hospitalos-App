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
  ListRow,
  PrimaryButton,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SecondaryButton,
  SectionHeader,
  SurfaceCard,
} from '@/components';
import { ApiError, describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { hospitalTime } from '@/services/format';
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

  return (
    <ScreenContainer>
      <ScreenHeader title={followUpId ? 'Book follow-up' : 'Book appointment'} back />
      <SectionHeader title="Doctor" />
      <QueryBoundary query={doctors} loadingLabel="Loading doctors">
        {(d) => (
          <SurfaceCard padding="none">
            {d.items.map((doc) => (
              <ListRow
                key={doc.id}
                title={`${doctorId === doc.id ? '✓ ' : ''}${doc.fullName}`}
                subtitle={`${doc.departmentName} · ${doc.specialty}`}
                onPress={() => {
                  setDoctorId(doc.id);
                  setSlot(null);
                }}
              />
            ))}
          </SurfaceCard>
        )}
      </QueryBoundary>

      {doctorId !== null && date !== null ? (
        <>
          <SectionHeader title="Day" meta={date} />
          <View style={styles.wrap}>
            {days.map((d) => (
              <SecondaryButton
                key={d}
                label={d === 0 ? 'Today' : addDays(hospital.data?.today ?? '', d).slice(5)}
                disabled={offset === d}
                onPress={() => {
                  setOffset(d);
                  setSlot(null);
                }}
              />
            ))}
          </View>
          <SectionHeader title="Free slots" />
          <QueryBoundary query={availability} loadingLabel="Loading free slots">
            {(a) =>
              a.slots.length === 0 ? (
                <AppText color="textSecondary">No free slots that day.</AppText>
              ) : (
                <View style={styles.wrap}>
                  {a.slots.slice(0, 48).map((s) => (
                    <SecondaryButton
                      key={s.start}
                      label={`${slot === s.start ? '✓ ' : ''}${hospitalTime(s.start)}`}
                      onPress={() => setSlot(s.start)}
                    />
                  ))}
                </View>
              )
            }
          </QueryBoundary>
        </>
      ) : null}

      {error !== null ? <Banner tone="danger" title="Not booked" message={error} /> : null}
      <PrimaryButton
        label={slot ? `Book ${hospitalTime(slot)} on ${date ?? ''}` : 'Choose a slot'}
        fullWidth
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
