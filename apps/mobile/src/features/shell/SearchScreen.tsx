import { patientSearchResultSchema } from '@hospitalos/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import {
  AppText,
  EmptyState,
  ListRow,
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
              <SurfaceCard padding="none">
                {data.items.map((p) => (
                  <ListRow
                    key={p.id}
                    title={`${p.firstName} ${p.lastName}`}
                    subtitle={`${p.mrn} · ${p.ageYears} y · ${humanize(p.sex)} · ${p.phone}`}
                    onPress={() =>
                      router.push({ pathname: '/patients/[id]', params: { id: p.id } })
                    }
                  />
                ))}
              </SurfaceCard>
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
      <AppText variant="title" accessibilityRole="header">
        Search
      </AppText>
      {canSearch ? (
        <PatientSearch />
      ) : (
        <EmptyState
          icon="search"
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
