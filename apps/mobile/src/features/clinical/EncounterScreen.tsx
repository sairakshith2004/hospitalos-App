import {
  encounterSchema,
  hospitalInfoSchema,
  labOrderSchema,
  labTestListSchema,
  medicineListSchema,
  prescriptionSchema,
  z,
  type Medicine,
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
  SearchField,
  SecondaryButton,
  SectionHeader,
  StatusChip,
  SurfaceCard,
  TextField,
} from '@/components';
import { ApiError, describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { spacing } from '@/theme/tokens';

type RxLine = {
  medicine: Medicine;
  dose: string;
  frequency: string;
  days: string;
  qty: string;
  substitution: boolean;
};

/**
 * The doctor's consultation workspace. Everything clinical is typed by the doctor; the app never
 * suggests a diagnosis, medicine or dose.
 */
export function EncounterScreen({ id }: { id: string }) {
  const router = useRouter();
  const encounter = useApiQuery(['encounter', id], `/api/v1/encounters/${id}`, encounterSchema);
  const hospital = useApiQuery(['hospital'], '/api/v1/hospital', hospitalInfoSchema);
  const tests = useApiQuery(['lab-tests'], '/api/v1/lab-tests', labTestListSchema);
  const [note, setNote] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [search, setSearch] = useState('');
  const medicines = useApiQuery(
    ['medicines', search],
    search.trim().length >= 2 ? `/api/v1/medicines?q=${encodeURIComponent(search.trim())}` : null,
    medicineListSchema,
  );
  const [lines, setLines] = useState<RxLine[]>([]);
  const [allergyWarning, setAllergyWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: 'success' | 'danger' | 'warning';
    title: string;
    text: string;
  } | null>(null);
  const invalidate = [['encounter', id], ['queue'], ['dashboard']] as const;

  const addNote = useApiMutation(
    (body: { kind: string; body: string }) => ({ path: `/api/v1/encounters/${id}/notes`, body }),
    encounterSchema,
    invalidate,
  );
  const addDiagnosis = useApiMutation(
    (body: { description: string }) => ({ path: `/api/v1/encounters/${id}/diagnoses`, body }),
    encounterSchema,
    invalidate,
  );
  const prescribe = useApiMutation(
    (body: unknown) => ({ path: `/api/v1/encounters/${id}/prescriptions`, body }),
    prescriptionSchema,
    invalidate,
  );
  const order = useApiMutation(
    (testId: string) => ({ path: `/api/v1/encounters/${id}/lab-orders`, body: { testId } }),
    labOrderSchema,
    invalidate,
  );
  const followUp = useApiMutation(
    (body: unknown) => ({ path: `/api/v1/encounters/${id}/follow-ups`, body }),
    z.object({ id: z.string() }),
    invalidate,
  );
  const complete = useApiMutation(
    () => ({ path: `/api/v1/encounters/${id}/complete` }),
    encounterSchema,
    invalidate,
  );

  const fail = (title: string) => (e: unknown) =>
    setMessage({ tone: 'danger', title, text: describeError(e) });

  function submitPrescription(acknowledged: boolean) {
    const items = lines.map((l) => ({
      stockItemId: l.medicine.stockItemId,
      dose: l.dose.trim(),
      frequency: l.frequency.trim(),
      route: l.medicine.route,
      ...(l.days.trim() ? { durationDays: Number(l.days) } : {}),
      qtyPrescribed: Number(l.qty),
      substitutionAllowed: l.substitution,
    }));
    void prescribe
      .mutateAsync({ items, allergyAcknowledged: acknowledged })
      .then((rx) => {
        setLines([]);
        setAllergyWarning(null);
        setMessage({
          tone: 'success',
          title: 'Prescription issued',
          text: `${rx.rxNo} is in the pharmacy queue.`,
        });
      })
      .catch((e: unknown) => {
        if (
          e instanceof ApiError &&
          e.code === 'UNPROCESSABLE' &&
          e.fields[0]?.path === 'allergyAcknowledged'
        ) {
          setAllergyWarning(e.fields[0].message);
          return;
        }
        fail('Not issued')(e);
      });
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="Consultation" back />
      {message !== null ? (
        <Banner tone={message.tone} title={message.title} message={message.text} />
      ) : null}
      <QueryBoundary query={encounter} loadingLabel="Loading consultation">
        {(e) => {
          const open = e.status === 'in_progress';
          return (
            <View style={styles.root}>
              <SurfaceCard>
                <AppText variant="label">{e.encounterNo}</AppText>
                <StatusChip
                  label={e.status.replace(/_/g, ' ')}
                  tone={open ? 'primary' : 'success'}
                />
                <SecondaryButton
                  label="Open chart"
                  onPress={() =>
                    router.push({ pathname: '/patients/[id]/chart', params: { id: e.patientId } })
                  }
                />
                {e.diagnoses.map((d) => (
                  <AppText key={d.id}>{`Diagnosis: ${d.description}`}</AppText>
                ))}
                {e.notes.map((n) => (
                  <AppText key={n.id} color="textSecondary">{`${n.kind}: ${n.body}`}</AppText>
                ))}
              </SurfaceCard>

              <SectionHeader title={open ? 'Notes' : 'Addendum'} />
              <SurfaceCard>
                <TextField
                  label={open ? 'Clinical note' : 'Addendum'}
                  value={note}
                  onChangeText={setNote}
                  multiline
                />
                <PrimaryButton
                  label={open ? 'Save note' : 'Add addendum'}
                  disabled={note.trim().length === 0}
                  loading={addNote.isPending}
                  onPress={() =>
                    void addNote
                      .mutateAsync({ kind: open ? 'observation' : 'addendum', body: note.trim() })
                      .then(() => setNote(''))
                      .catch(fail('Not saved'))
                  }
                />
              </SurfaceCard>

              {open ? (
                <>
                  <SectionHeader title="Diagnosis" />
                  <SurfaceCard>
                    <TextField
                      label="Diagnosis (typed by you)"
                      value={diagnosis}
                      onChangeText={setDiagnosis}
                    />
                    <PrimaryButton
                      label="Add diagnosis"
                      disabled={diagnosis.trim().length === 0}
                      loading={addDiagnosis.isPending}
                      onPress={() =>
                        void addDiagnosis
                          .mutateAsync({ description: diagnosis.trim() })
                          .then(() => setDiagnosis(''))
                          .catch(fail('Not saved'))
                      }
                    />
                  </SurfaceCard>

                  <SectionHeader title="Prescription" />
                  <SurfaceCard>
                    <SearchField
                      label="Find medicine by generic or brand"
                      value={search}
                      onChangeText={setSearch}
                    />
                    {(medicines.data?.items ?? []).map((m) => (
                      <ListRow
                        key={m.stockItemId}
                        title={m.brandName}
                        subtitle={`${m.ingredients.map((i) => `${i.name} ${i.strength} ${i.unit}`).join(' + ')} · ${m.dosageForm} · ${m.availableQty} available`}
                        onPress={() => {
                          setLines((current) => [
                            ...current,
                            {
                              medicine: m,
                              dose: '',
                              frequency: '',
                              days: '',
                              qty: '',
                              substitution: false,
                            },
                          ]);
                          setSearch('');
                        }}
                      />
                    ))}
                    {lines.map((l, index) => (
                      <View key={`${l.medicine.stockItemId}-${index}`} style={styles.line}>
                        <AppText variant="label">{l.medicine.brandName}</AppText>
                        {(['dose', 'frequency', 'days', 'qty'] as const).map((field) => (
                          <TextField
                            key={field}
                            label={
                              {
                                dose: 'Dose',
                                frequency: 'Frequency',
                                days: 'Days (optional)',
                                qty: `Quantity (${l.medicine.baseUnit})`,
                              }[field]
                            }
                            value={l[field]}
                            keyboardType={
                              field === 'days' || field === 'qty' ? 'number-pad' : 'default'
                            }
                            onChangeText={(text) =>
                              setLines((current) =>
                                current.map((x, i) => (i === index ? { ...x, [field]: text } : x)),
                              )
                            }
                          />
                        ))}
                        <SecondaryButton
                          label={l.substitution ? 'Substitution allowed ✓' : 'Allow substitution'}
                          onPress={() =>
                            setLines((current) =>
                              current.map((x, i) =>
                                i === index ? { ...x, substitution: !x.substitution } : x,
                              ),
                            )
                          }
                        />
                        <SecondaryButton
                          label="Remove"
                          onPress={() =>
                            setLines((current) => current.filter((_, i) => i !== index))
                          }
                        />
                      </View>
                    ))}
                    {allergyWarning !== null ? (
                      <>
                        <Banner
                          tone="danger"
                          title="Matches a recorded allergy"
                          message={allergyWarning}
                        />
                        <PrimaryButton
                          label="I have reviewed the allergy: issue"
                          onPress={() => submitPrescription(true)}
                        />
                      </>
                    ) : null}
                    <PrimaryButton
                      label="Issue prescription"
                      disabled={
                        lines.length === 0 ||
                        lines.some(
                          (l) => !l.dose.trim() || !l.frequency.trim() || !(Number(l.qty) > 0),
                        )
                      }
                      loading={prescribe.isPending}
                      onPress={() => submitPrescription(false)}
                    />
                  </SurfaceCard>

                  <SectionHeader title="Lab tests" />
                  <QueryBoundary query={tests} loadingLabel="Loading tests">
                    {(t) => (
                      <SurfaceCard padding="none">
                        {t.items.map((test) => (
                          <ListRow
                            key={test.id}
                            title={test.name}
                            subtitle={`${test.sampleType} · about ${test.turnaroundHours} h`}
                            onPress={() =>
                              void order
                                .mutateAsync(test.id)
                                .then((o) =>
                                  setMessage({
                                    tone: 'success',
                                    title: 'Test ordered',
                                    text: `${o.orderNo} is on the lab worklist.`,
                                  }),
                                )
                                .catch(fail('Not ordered'))
                            }
                          />
                        ))}
                      </SurfaceCard>
                    )}
                  </QueryBoundary>

                  <SectionHeader title="Follow-up" />
                  <SurfaceCard>
                    <AppText color="textSecondary">
                      Recommend a review in 7–14 days. Reception books it.
                    </AppText>
                    <SecondaryButton
                      label="Recommend follow-up"
                      loading={followUp.isPending}
                      onPress={() => {
                        const today = hospital.data?.today;
                        if (!today) return;
                        const plus = (days: number) => {
                          const d = new Date(`${today}T12:00:00Z`);
                          d.setUTCDate(d.getUTCDate() + days);
                          return d.toISOString().slice(0, 10);
                        };
                        void followUp
                          .mutateAsync({
                            reason: 'Review after treatment',
                            dueFrom: plus(7),
                            dueTo: plus(14),
                          })
                          .then(() =>
                            setMessage({
                              tone: 'success',
                              title: 'Follow-up recommended',
                              text: 'Reception sees it in Follow-ups.',
                            }),
                          )
                          .catch(fail('Not saved'));
                      }}
                    />
                  </SurfaceCard>

                  <PrimaryButton
                    label="Complete consultation"
                    fullWidth
                    loading={complete.isPending}
                    onPress={() =>
                      void complete
                        .mutateAsync(undefined)
                        .then(() =>
                          setMessage({
                            tone: 'success',
                            title: 'Completed',
                            text: 'The appointment is complete. Addenda can still be added.',
                          }),
                        )
                        .catch(fail('Not completed'))
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
  line: { gap: spacing.sm, paddingVertical: spacing.sm },
});
