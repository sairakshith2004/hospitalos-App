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
  ActionRow,
  AppText,
  Banner,
  BottomSheet,
  DataRow,
  DoctorCard,
  EmptyState,
  GlassCard,
  PatientCard,
  PrimaryButton,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SecondaryButton,
  SectionHeader,
  StatusChip,
  SurfaceCard,
  statusTone,
} from '@/components';
import { useSignedInSession } from '@/features/session/SessionProvider';
import { describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { formatPaise, humanize } from '@/services/format';
import { borders, colors, radius, spacing, toneColors } from '@/theme/tokens';

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
      <ScreenHeader title="Patient" eyebrow="PATIENT RECORD" back />
      <QueryBoundary query={patient} loadingLabel="Loading patient">
        {(p) => (
          <GlassCard tone="hero" padding="lg" enterIndex={0}>
            <PatientCard
              size="header"
              name={`${p.firstName} ${p.lastName}`}
              mrn={p.mrn}
              meta={[`${p.ageYears} y`, humanize(p.sex)]}
            />
            <View style={styles.facts}>
              <DataRow label="Mobile" value={p.phone} />
              <DataRow label="Date of birth" value={p.dob} />
              {p.bloodGroup !== null ? <DataRow label="Blood group" value={p.bloodGroup} /> : null}
              {p.email !== null ? <DataRow label="Email" value={p.email} /> : null}
            </View>
            <ActionRow>
              {can('appointment:book') ? (
                <PrimaryButton
                  label="Book appointment"
                  fullWidth
                  onPress={() => router.push({ pathname: '/book', params: { patientId: p.id } })}
                />
              ) : null}
              {can('appointment:check_in') ? (
                <SecondaryButton label="Walk-in" fullWidth onPress={() => setWalkIn(true)} />
              ) : null}
              {can('patient:read_clinical') ? (
                <SecondaryButton
                  label="Chart"
                  fullWidth
                  onPress={() =>
                    router.push({ pathname: '/patients/[id]/chart', params: { id: p.id } })
                  }
                />
              ) : null}
            </ActionRow>
          </GlassCard>
        )}
      </QueryBoundary>

      {message !== null ? (
        <Banner
          tone={message.tone}
          title={message.tone === 'success' ? 'Done' : 'Not done'}
          message={message.text}
        />
      ) : null}

      <BottomSheet
        visible={walkIn}
        title="Walk-in: choose a doctor"
        onClose={() => setWalkIn(false)}
      >
        <AppText variant="bodySmall" color="textMuted">
          {
            "The patient is checked in at once with a queue token; the consultation fee goes on the visit's bill."
          }
        </AppText>
        <QueryBoundary query={doctors} loadingLabel="Loading doctors">
          {(d) => (
            <View style={styles.doctors}>
              {d.items.map((doc) => (
                <DoctorCard
                  key={doc.id}
                  name={doc.fullName}
                  department={doc.departmentName}
                  specialty={doc.specialty}
                  fee={formatPaise(doc.consultationFeePaise)}
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
                      .catch((e: unknown) => {
                        setWalkIn(false);
                        setMessage({ tone: 'danger', text: describeError(e) });
                      })
                  }
                />
              ))}
            </View>
          )}
        </QueryBoundary>
      </BottomSheet>

      <SectionHeader title="Visits" />
      <QueryBoundary query={visits} loadingLabel="Loading visits">
        {(v) =>
          v.items.length === 0 ? (
            <SurfaceCard padding="none">
              <EmptyState
                icon="calendar"
                title="No visits yet"
                message={
                  can('appointment:book')
                    ? 'Book an appointment or register a walk-in to start a visit.'
                    : 'Visits appear here once the patient is booked.'
                }
              />
            </SurfaceCard>
          ) : (
            <SurfaceCard padding="md" enterIndex={1}>
              {v.items.map((visit, index) => (
                <View key={visit.appointmentId} style={styles.visit}>
                  <View style={styles.rail}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: toneColors[statusTone(visit.status)].fg },
                      ]}
                    />
                    {index < v.items.length - 1 ? <View style={styles.line} /> : null}
                  </View>
                  <View style={styles.visitBody} accessible>
                    <View style={styles.visitTop}>
                      <AppText variant="bodyStrong" style={styles.visitDate}>
                        {visit.visitDate}
                      </AppText>
                      <StatusChip label={humanize(visit.status)} tone={statusTone(visit.status)} />
                    </View>
                    <AppText variant="bodySmall" color="textSecondary">
                      {visit.doctorName}
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      {`${visit.departmentName}  ·  ${visit.appointmentNo}`}
                    </AppText>
                  </View>
                </View>
              ))}
            </SurfaceCard>
          )
        }
      </QueryBoundary>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  facts: { gap: spacing.xxs },
  doctors: { gap: spacing.xs },
  visit: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: spacing.md },
  dot: {
    width: spacing.sm + 2,
    height: spacing.sm + 2,
    borderRadius: radius.pill,
    marginTop: spacing.xs + 2,
  },
  line: { flex: 1, width: borders.focus, backgroundColor: colors.border, marginTop: spacing.xs },
  visitBody: { flex: 1, gap: spacing.xxs, paddingBottom: spacing.lg },
  visitTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  visitDate: { flex: 1 },
});
