import { patientSearchResultSchema } from '@hospitalos/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import {
  AppText,
  Divided,
  EmptyState,
  GradientHeader,
  PatientCard,
  QueryBoundary,
  ScreenContainer,
  SearchField,
  SurfaceCard,
} from '@/components';
import { useSignedInSession } from '@/features/session/SessionProvider';
import { useApiQuery } from '@/services/api/hooks';
import { humanize } from '@/services/format';

/** Patient search by MRN (MRN000123, mrn 123 or 123), phone or name; at most 20 results. */
function PatientSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const results = useApiQuery(
    ['patients', 'search', submitted],
    submitted.trim().length >= 2
      ? `/api/v1/patients?q=${encodeURIComponent(submitted.trim())}`
      : null,
    patientSearchResultSchema,
  );
  return (
    <>
      <SearchField
        label="MRN, phone or name"
        value={query}
        onChangeText={setQuery}
        onSubmit={() => setSubmitted(query)}
      />
      {submitted.trim().length < 2 ? (
        <EmptyState
          icon="search"
          title="Find a patient"
          message="Type at least 2 characters and press search. Every search is recorded in the audit log."
        />
      ) : (
        <QueryBoundary query={results} loadingLabel="Searching">
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState
                icon="search"
                title="No patients found"
                message="Check the spelling, or register the patient from the Work Queue."
              />
            ) : (
              <>
                <AppText variant="caption" color="textMuted">
                  {`${data.items.length} ${data.items.length === 1 ? 'patient' : 'patients'} · at most 20 shown`}
                </AppText>
                <SurfaceCard padding="none" enterIndex={0}>
                  <Divided>
                    {data.items.map((p) => (
                      <PatientCard
                        key={p.id}
                        name={`${p.firstName} ${p.lastName}`}
                        mrn={p.mrn}
                        meta={[`${p.ageYears} y`, humanize(p.sex), p.phone]}
                        onPress={() =>
                          router.push({ pathname: '/patients/[id]', params: { id: p.id } })
                        }
                      />
                    ))}
                  </Divided>
                </SurfaceCard>
              </>
            )
          }
        </QueryBoundary>
      )}
    </>
  );
}

export function SearchScreen() {
  const session = useSignedInSession();
  const canSearch =
    session.kind === 'authenticated' &&
    session.permissions.some((p) => p === 'patient:read_demographics');
  return (
    <ScreenContainer bottomInset={false}>
      <GradientHeader eyebrow="PATIENTS" title="Search" />
      {canSearch ? (
        <PatientSearch />
      ) : (
        <EmptyState
          icon="lock"
          tone="neutral"
          title="Search across HospitalOS"
          message={
            session.kind === 'authenticated'
              ? 'Your role has no patient search.'
              : 'Results only include records your role is allowed to see.'
          }
        />
      )}
    </ScreenContainer>
  );
}
