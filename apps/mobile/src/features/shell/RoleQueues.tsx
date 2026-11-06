import {
  appointmentListSchema,
  appointmentSchema,
  z,
  invoiceListSchema,
  labOrderListSchema,
  prescriptionListSchema,
  type Appointment,
} from '@hospitalos/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  DangerButton,
  EmptyState,
  GlassCard,
  ListRow,
  PrimaryButton,
  QueryBoundary,
  SecondaryButton,
  SectionHeader,
  StatusChip,
  TextField,
} from '@/components';
import type { Permission } from '@/features/access/permissions';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { describeError } from '@/services/api/errors';
import { formatPaise, hospitalTime, humanize } from '@/services/format';
import { borders, colors, spacing } from '@/theme/tokens';

const QUEUE_REFRESH = 15_000;

function statusTone(status: string) {
  if (status === 'checked_in' || status === 'issued' || status === 'resulted')
    return 'warning' as const;
  if (
    status === 'in_consultation' ||
    status === 'in_process' ||
    status === 'partially_dispensed' ||
    status === 'partially_paid'
  )
    return 'primary' as const;
  if (
    status === 'completed' ||
    status === 'verified' ||
    status === 'dispensed' ||
    status === 'paid'
  )
    return 'success' as const;
  if (status === 'cancelled' || status === 'no_show') return 'danger' as const;
  return 'neutral' as const;
}

function Rows({ children }: { children: React.ReactNode[] }) {
  return (
    <GlassCard padding="none" elevation="low">
      {children.map((child, index) => (
        <View key={index} style={index > 0 && styles.divider}>
          {child}
        </View>
      ))}
    </GlassCard>
  );
}

// Reception ------------------------------------------------------------------------------------
function AppointmentActions({ appointment }: { appointment: Appointment }) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const checkIn = useApiMutation(
    (id: string) => ({ path: `/api/v1/appointments/${id}/check-in`, idempotent: true }),
    appointmentSchema,
    [['appointments'], ['dashboard'], ['queue']],
  );
  const cancel = useApiMutation(
    (body: { id: string; reason: string }) => ({
      path: `/api/v1/appointments/${body.id}/cancel`,
      body: { reason: body.reason },
    }),
    appointmentSchema,
    [['appointments'], ['dashboard']],
  );
  const noShow = useApiMutation(
    (id: string) => ({ path: `/api/v1/appointments/${id}/no-show` }),
    appointmentSchema,
    [['appointments'], ['dashboard']],
  );
  const run = (promise: Promise<unknown>) =>
    promise.then(() => setError(null)).catch((e: unknown) => setError(describeError(e)));

  return (
    <View style={styles.actions}>
      {appointment.status === 'booked' && !appointment.didNotArrive ? (
        <PrimaryButton
          label="Check in"
          loading={checkIn.isPending}
          onPress={() => void run(checkIn.mutateAsync(appointment.id))}
        />
      ) : null}
      {appointment.status === 'booked' && appointment.didNotArrive ? (
        <SecondaryButton
          label="Mark no-show"
          loading={noShow.isPending}
          onPress={() => void run(noShow.mutateAsync(appointment.id))}
        />
      ) : null}
      {appointment.status === 'booked' || appointment.status === 'checked_in' ? (
        <SecondaryButton label="Cancel" onPress={() => setCancelling(true)} />
      ) : null}
      {error !== null ? <Banner tone="danger" title="Not done" message={error} /> : null}
      {cancelling ? (
        <View style={styles.cancel}>
          <TextField label="Reason for cancelling" value={reason} onChangeText={setReason} />
          <AppText variant="caption" color="textSecondary">
            A fee on a draft bill comes off it; an issued bill gets a correction for Finance.
          </AppText>
          <View style={styles.actionsInline}>
            <DangerButton
              label="Confirm cancel"
              loading={cancel.isPending}
              disabled={reason.trim().length < 3}
              onPress={() => {
                setCancelling(false);
                void run(cancel.mutateAsync({ id: appointment.id, reason: reason.trim() }));
              }}
            />
            <SecondaryButton label="Keep" onPress={() => setCancelling(false)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ReceptionQueue() {
  const router = useRouter();
  const query = useApiQuery(
    ['appointments', 'today'],
    '/api/v1/appointments',
    appointmentListSchema,
    { refetchInterval: QUEUE_REFRESH },
  );
  return (
    <View style={styles.section}>
      <SectionHeader
        title="Today's appointments"
        action={{ label: 'Follow-ups', onPress: () => router.push('/follow-ups') }}
      />
      <View style={styles.actions}>
        <PrimaryButton label="Register patient" onPress={() => router.push('/patients/register')} />
        <SecondaryButton label="Find patient" onPress={() => router.navigate('/search')} />
      </View>
      <QueryBoundary query={query} loadingLabel="Loading appointments">
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No appointments today"
              message="Book from a patient's page (Search)."
            />
          ) : (
            <Rows>
              {data.items.map((a) => (
                <View key={a.id} style={styles.item}>
                  <ListRow
                    title={`${a.tokenNo !== null ? `#${a.tokenNo} · ` : ''}${a.patient.name}`}
                    subtitle={`${a.patient.mrn} · ${a.doctor.name}${a.slotStart ? ` · ${hospitalTime(a.slotStart)}` : ' · walk-in'}`}
                    trailing={
                      <StatusChip
                        label={a.didNotArrive ? 'Did not arrive' : humanize(a.status)}
                        tone={a.didNotArrive ? 'danger' : statusTone(a.status)}
                      />
                    }
                    onPress={() =>
                      router.push({ pathname: '/patients/[id]', params: { id: a.patient.id } })
                    }
                  />
                  <AppointmentActions appointment={a} />
                </View>
              ))}
            </Rows>
          )
        }
      </QueryBoundary>
    </View>
  );
}

// Doctor and nurse ----------------------------------------------------------------------------
function ClinicalQueue({ nurse }: { nurse: boolean }) {
  const router = useRouter();
  const query = useApiQuery(
    ['queue', nurse ? 'nurse' : 'doctor'],
    '/api/v1/queue',
    appointmentListSchema,
    { refetchInterval: QUEUE_REFRESH },
  );
  const start = useApiMutation(
    (appointmentId: string) => ({ path: '/api/v1/encounters', body: { appointmentId } }),
    z.object({ id: z.string() }),
    [['queue'], ['dashboard']],
  );
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={styles.section}>
      <SectionHeader title={nurse ? 'My patients today' : 'My queue'} meta="Checked in" />
      {error !== null ? <Banner tone="danger" title="Not done" message={error} /> : null}
      <QueryBoundary query={query} loadingLabel="Loading queue">
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState
              icon="queue"
              title="Nobody waiting"
              message={
                nurse
                  ? 'Patients appear when they check in to a session you are assigned to today.'
                  : 'Patients appear here when reception checks them in.'
              }
            />
          ) : (
            <Rows>
              {data.items.map((a) => (
                <View key={a.id} style={styles.item}>
                  <ListRow
                    title={`#${a.tokenNo ?? '–'} · ${a.patient.name}`}
                    subtitle={`${a.patient.mrn}${nurse ? ` · ${a.doctor.name}` : ''}`}
                    trailing={<StatusChip label={humanize(a.status)} tone={statusTone(a.status)} />}
                  />
                  <View style={styles.actions}>
                    <SecondaryButton
                      label="Vitals"
                      onPress={() =>
                        router.push({
                          pathname: '/vitals/[appointmentId]',
                          params: { appointmentId: a.id },
                        })
                      }
                    />
                    {nurse ? null : a.status === 'checked_in' ? (
                      <PrimaryButton
                        label="Start consultation"
                        loading={start.isPending}
                        onPress={() =>
                          void start
                            .mutateAsync(a.id)
                            .then((encounter) =>
                              router.push({
                                pathname: '/encounters/[id]',
                                params: { id: encounter.id },
                              }),
                            )
                            .catch((e: unknown) => setError(describeError(e)))
                        }
                      />
                    ) : (
                      <SecondaryButton
                        label="Open chart"
                        onPress={() =>
                          router.push({
                            pathname: '/patients/[id]/chart',
                            params: { id: a.patient.id },
                          })
                        }
                      />
                    )}
                  </View>
                </View>
              ))}
            </Rows>
          )
        }
      </QueryBoundary>
    </View>
  );
}

// Pharmacy, laboratory, billing -----------------------------------------------------------------
function PharmacyQueue() {
  const router = useRouter();
  const query = useApiQuery(['prescriptions'], '/api/v1/prescriptions', prescriptionListSchema, {
    refetchInterval: QUEUE_REFRESH,
  });
  return (
    <View style={styles.section}>
      <SectionHeader title="Prescriptions to dispense" />
      <QueryBoundary query={query} loadingLabel="Loading prescriptions">
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState icon="medkit" title="No prescriptions waiting" />
          ) : (
            <Rows>
              {data.items.map((rx) => (
                <ListRow
                  key={rx.id}
                  title={`${rx.rxNo} · ${rx.patient.name}`}
                  subtitle={`${rx.patient.mrn} · ${rx.doctorName} · ${rx.items.length} item(s)${rx.allergies.length > 0 ? ' · allergies' : ''}`}
                  trailing={
                    <StatusChip
                      label={rx.expired ? 'Expired' : humanize(rx.status)}
                      tone={rx.expired ? 'danger' : statusTone(rx.status)}
                    />
                  }
                  onPress={() =>
                    router.push({ pathname: '/prescriptions/[id]', params: { id: rx.id } })
                  }
                />
              ))}
            </Rows>
          )
        }
      </QueryBoundary>
    </View>
  );
}

function LabQueue() {
  const router = useRouter();
  const query = useApiQuery(['lab-orders'], '/api/v1/lab-orders', labOrderListSchema, {
    refetchInterval: QUEUE_REFRESH,
  });
  return (
    <View style={styles.section}>
      <SectionHeader title="Laboratory worklist" />
      <QueryBoundary query={query} loadingLabel="Loading worklist">
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState icon="flask" title="No open lab orders" />
          ) : (
            <Rows>
              {data.items.map((o) => (
                <ListRow
                  key={o.id}
                  title={`${o.orderNo} · ${o.test.name}`}
                  subtitle={`${o.patient.name} · ${o.patient.mrn}${o.priority === 'urgent' ? ' · URGENT' : ''}`}
                  trailing={<StatusChip label={humanize(o.status)} tone={statusTone(o.status)} />}
                  onPress={() =>
                    router.push({ pathname: '/lab-orders/[id]', params: { id: o.id } })
                  }
                />
              ))}
            </Rows>
          )
        }
      </QueryBoundary>
    </View>
  );
}

function BillingQueue() {
  const router = useRouter();
  const [status, setStatus] = useState<'draft' | 'issued' | 'partially_paid'>('issued');
  const query = useApiQuery(
    ['invoices', status],
    `/api/v1/invoices?status=${status}`,
    invoiceListSchema,
    { refetchInterval: QUEUE_REFRESH },
  );
  return (
    <View style={styles.section}>
      <SectionHeader title="Invoices" />
      <View style={styles.actions}>
        {(['draft', 'issued', 'partially_paid'] as const).map((s) => (
          <SecondaryButton
            key={s}
            label={humanize(s)}
            onPress={() => setStatus(s)}
            disabled={status === s}
          />
        ))}
      </View>
      <QueryBoundary query={query} loadingLabel="Loading invoices">
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState icon="cash" title={`No ${humanize(status).toLowerCase()} invoices`} />
          ) : (
            <Rows>
              {data.items.map((inv) => (
                <ListRow
                  key={inv.id}
                  title={`${inv.invoiceNo ?? 'Draft'} · ${inv.patient.name}`}
                  subtitle={`${formatPaise(inv.totalPaise)} · paid ${formatPaise(inv.paidPaise)}${inv.pendingCorrectionsPaise > 0 ? ' · correction pending' : ''}`}
                  trailing={
                    <StatusChip label={humanize(inv.status)} tone={statusTone(inv.status)} />
                  }
                  onPress={() =>
                    router.push({ pathname: '/invoices/[id]', params: { id: inv.id } })
                  }
                />
              ))}
            </Rows>
          )
        }
      </QueryBoundary>
    </View>
  );
}

/** The Work Queue for a signed-in account: one section per part of the role (from the API's permissions). */
export function RoleQueues({
  permissions,
  roles,
}: {
  permissions: readonly Permission[];
  roles: readonly string[];
}) {
  const has = (p: Permission) => permissions.includes(p);
  const sections = [
    has('appointment:check_in') ? <ReceptionQueue key="reception" /> : null,
    has('encounter:write') ? <ClinicalQueue key="doctor" nurse={false} /> : null,
    roles.includes('NUR') ? <ClinicalQueue key="nurse" nurse /> : null,
    has('prescription:dispense') ? <PharmacyQueue key="pharmacy" /> : null,
    has('lab:process') || has('lab_result:verify') ? <LabQueue key="lab" /> : null,
    has('invoice:read') && !has('appointment:check_in') ? <BillingQueue key="billing" /> : null,
  ].filter((section) => section !== null);
  if (sections.length === 0) {
    return (
      <EmptyState
        icon="queue"
        title="No work queue for your role yet"
        message="Your role's modules arrive in a later release."
      />
    );
  }
  return <View style={styles.section}>{sections}</View>;
}

export function QueueHint() {
  return (
    <AppText variant="caption" color="textMuted">
      Refreshes every 15 seconds while open.
    </AppText>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  item: { paddingBottom: spacing.sm },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  actionsInline: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cancel: { gap: spacing.sm, paddingHorizontal: spacing.lg, width: '100%' },
  divider: { borderTopWidth: borders.hairline, borderTopColor: colors.border },
});
