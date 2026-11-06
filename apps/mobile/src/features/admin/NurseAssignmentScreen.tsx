import {
  doctorListSchema,
  hospitalInfoSchema,
  nurseAssignmentListSchema,
  scheduleListSchema,
  staffListSchema,
  z,
} from '@hospitalos/contracts';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Banner,
  ChoiceChip,
  DoctorCard,
  ListRow,
  PrimaryButton,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  SurfaceCard,
} from '@/components';
import { describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { spacing } from '@/theme/tokens';

/** Administrators assign a nurse to a doctor's session for today (workflows §5, nurse assignment). */
export function NurseAssignmentScreen() {
  const hospital = useApiQuery(['hospital'], '/api/v1/hospital', hospitalInfoSchema);
  const today = hospital.data?.today ?? null;
  const assignments = useApiQuery(
    ['nurse-assignments', today],
    today ? `/api/v1/nurse-assignments?date=${today}` : null,
    nurseAssignmentListSchema,
  );
  const doctors = useApiQuery(['doctors'], '/api/v1/doctors', doctorListSchema);
  const staff = useApiQuery(['staff'], '/api/v1/admin/staff', staffListSchema);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [nurseId, setNurseId] = useState<string | null>(null);
  const schedules = useApiQuery(
    ['schedules', doctorId],
    doctorId ? `/api/v1/doctors/${doctorId}/schedules` : null,
    scheduleListSchema,
  );
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const assign = useApiMutation(
    (body: unknown) => ({ path: '/api/v1/nurse-assignments', body }),
    z.object({ id: z.string() }),
    [['nurse-assignments']],
  );
  const isoDow = today ? ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7) + 1 : 0;
  const session = schedules.data?.items.find((s) => s.active && s.weekday === isoDow);

  return (
    <ScreenContainer>
      <ScreenHeader
        title="Nurse assignments"
        {...(today ? { subtitle: `Sessions on ${today}` } : {})}
        back
      />
      {message !== null ? (
        <Banner
          tone={message.tone}
          title={message.tone === 'success' ? 'Assigned' : 'Not assigned'}
          message={message.text}
        />
      ) : null}
      <SectionHeader title="Today" />
      <QueryBoundary query={assignments} loadingLabel="Loading assignments">
        {(a) => (
          <SurfaceCard padding="none">
            {a.items.length === 0 ? <ListRow title="No nurse assigned yet today" /> : null}
            {a.items.map((x) => (
              <ListRow
                key={x.id}
                title={`${x.nurseName} → ${x.doctorName}`}
                subtitle={`${x.startTime}–${x.endTime}`}
              />
            ))}
          </SurfaceCard>
        )}
      </QueryBoundary>
      <SectionHeader title="Nurse" />
      <QueryBoundary query={staff} loadingLabel="Loading nurses">
        {(s) => (
          <View style={styles.wrap}>
            {s.items
              .filter((u) => u.roles.includes('NUR') && u.status === 'active')
              .map((u) => (
                <ChoiceChip
                  key={u.id}
                  label={u.fullName}
                  selected={nurseId === u.id}
                  onPress={() => setNurseId(u.id)}
                />
              ))}
          </View>
        )}
      </QueryBoundary>
      <SectionHeader title="Doctor" />
      <QueryBoundary query={doctors} loadingLabel="Loading doctors">
        {(d) => (
          <SurfaceCard padding="sm">
            {d.items.map((doc) => (
              <DoctorCard
                key={doc.id}
                name={doc.fullName}
                department={doc.departmentName}
                specialty={doc.specialty}
                selected={doctorId === doc.id}
                onPress={() => setDoctorId(doc.id)}
              />
            ))}
          </SurfaceCard>
        )}
      </QueryBoundary>
      <PrimaryButton
        label={
          session
            ? `Assign to ${session.startTime}–${session.endTime}`
            : 'Choose a nurse and a doctor with hours today'
        }
        fullWidth
        disabled={!session || nurseId === null || today === null}
        loading={assign.isPending}
        onPress={() =>
          session &&
          void assign
            .mutateAsync({ nurseUserId: nurseId, doctorScheduleId: session.id, sessionDate: today })
            .then(() =>
              setMessage({
                tone: 'success',
                text: 'The nurse sees this session’s checked-in patients today.',
              }),
            )
            .catch((e: unknown) => setMessage({ tone: 'danger', text: describeError(e) }))
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
