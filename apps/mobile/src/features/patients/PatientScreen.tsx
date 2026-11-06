import {
  appointmentSchema,
  doctorListSchema,
  patientSummarySchema,
  visitHistorySchema,
} from '@hospitalos/contracts';
import { useRouter } from 'expo-router';
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
  SecondaryButton,
  SectionHeader,
  StatusChip,
  SurfaceCard,
} from '@/components';
import { useSignedInSession } from '@/features/session/SessionProvider';
import { describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { humanize } from '@/services/format';
import { spacing } from '@/theme/tokens';

/** A patient's demographics and visits; actions depend on the signed-in user's permissions. */
export function PatientScreen({ id }: { id: string }) {
  const router = useRouter();
  const session = useSignedInSession();
  const can = (p: string) => session.permissions.some((x) => x === p);
  const patient = useApiQuery(['patient', id], `/api/v1/patients/${id}`, patientSummarySchema);
  const visits = useApiQuery(
    ['patient', id, 'visits'],
    `/api/v1/patients/${id}/visits`,
    visitHistorySchema,
  );
  const [walkIn, setWalkIn] = useState(false);
  const doctors = useApiQuery(['doctors'], walkIn ? '/api/v1/doctors' : null, doctorListSchema);
  const walkInMutation = useApiMutation(
    (doctorId: string) => ({
      path: '/api/v1/appointments/walk-in',
      body: { patientId: id, doctorId },
      idempotent: true,
    }),
    appointmentSchema,
    [['appointments'], ['dashboard'], ['patient', id, 'visits']],
  );
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  return (
    <ScreenContainer>
      <ScreenHeader title="Patient" back />
      <QueryBoundary query={patient} loadingLabel="Loading patient">
        {(p) => (
          <SurfaceCard>
            <AppText variant="headline">{`${p.firstName} ${p.lastName}`}</AppText>
            <AppText color="textSecondary">{`${p.mrn} · ${p.ageYears} y · ${humanize(p.sex)} · ${p.phone}`}</AppText>
            {p.bloodGroup !== null ? (
              <StatusChip label={`Blood group ${p.bloodGroup}`} tone="neutral" dot={false} />
            ) : null}
            <View style={styles.actions}>
              {can('appointment:book') ? (
                <PrimaryButton
                  label="Book appointment"
                  onPress={() => router.push({ pathname: '/book', params: { patientId: p.id } })}
                />
              ) : null}
              {can('appointment:check_in') ? (
                <SecondaryButton label="Walk-in" onPress={() => setWalkIn((v) => !v)} />
              ) : null}
              {can('patient:read_clinical') ? (
                <SecondaryButton
                  label="Chart"
                  onPress={() =>
                    router.push({ pathname: '/patients/[id]/chart', params: { id: p.id } })
                  }
                />
              ) : null}
            </View>
          </SurfaceCard>
        )}
      </QueryBoundary>

      {message !== null ? (
        <Banner
          tone={message.tone}
          title={message.tone === 'success' ? 'Done' : 'Not done'}
          message={message.text}
        />
      ) : null}
      {walkIn ? (
        <SurfaceCard padding="none">
          <SectionHeader title="Walk-in: choose a doctor" />
          <QueryBoundary query={doctors} loadingLabel="Loading doctors">
            {(d) => (
              <View>
                {d.items.map((doc) => (
                  <ListRow
                    key={doc.id}
                    title={doc.fullName}
                    subtitle={`${doc.departmentName} · ${doc.specialty}`}
                    onPress={() =>
                      void walkInMutation
                        .mutateAsync(doc.id)
                        .then((a) => {
                          setWalkIn(false);
                          setMessage({
                            tone: 'success',
                            text: `Token ${a.tokenNo ?? ''} with ${a.doctor.name}. The fee is on the visit's bill.`,
                          });
                        })
                        .catch((e: unknown) =>
                          setMessage({ tone: 'danger', text: describeError(e) }),
                        )
                    }
                  />
                ))}
              </View>
            )}
          </QueryBoundary>
        </SurfaceCard>
      ) : null}

      <SectionHeader title="Visits" />
      <QueryBoundary query={visits} loadingLabel="Loading visits">
        {(v) =>
          v.items.length === 0 ? (
            <AppText color="textSecondary">No visits yet.</AppText>
          ) : (
            <SurfaceCard padding="none">
              {v.items.map((visit) => (
                <ListRow
                  key={visit.appointmentId}
                  title={`${visit.visitDate} · ${visit.doctorName}`}
                  subtitle={`${visit.departmentName} · ${visit.appointmentNo}`}
                  trailing={<StatusChip label={humanize(visit.status)} tone="neutral" />}
                />
              ))}
            </SurfaceCard>
          )
        }
      </QueryBoundary>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
