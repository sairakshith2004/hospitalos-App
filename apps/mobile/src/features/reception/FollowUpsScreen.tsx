import { followUpListSchema } from '@hospitalos/contracts';
import { useRouter } from 'expo-router';

import {
  EmptyState,
  ListRow,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  StatusChip,
  SurfaceCard,
} from '@/components';
import { useApiQuery } from '@/services/api/hooks';
import { humanize } from '@/services/format';

/** Follow-ups waiting to be booked; "due" and "overdue" are computed by the server when read. */
export function FollowUpsScreen() {
  const router = useRouter();
  const query = useApiQuery(
    ['follow-ups', 'pending'],
    '/api/v1/follow-ups?status=pending',
    followUpListSchema,
    { refetchInterval: 30_000 },
  );
  return (
    <ScreenContainer>
      <ScreenHeader
        title="Follow-ups"
        subtitle="Recommended by doctors, waiting to be booked"
        back
      />
      <QueryBoundary query={query} loadingLabel="Loading follow-ups">
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState icon="calendar" title="No follow-ups waiting" />
          ) : (
            <SurfaceCard padding="none">
              {data.items.map((f) => (
                <ListRow
                  key={f.id}
                  title={`${f.patient.name} · ${f.patient.mrn}`}
                  subtitle={`${f.reason} · ${f.dueFrom} to ${f.dueTo}`}
                  trailing={
                    <StatusChip
                      label={humanize(f.timing)}
                      tone={
                        f.timing === 'overdue'
                          ? 'danger'
                          : f.timing === 'due'
                            ? 'warning'
                            : 'neutral'
                      }
                    />
                  }
                  onPress={() =>
                    router.push({
                      pathname: '/book',
                      params: { patientId: f.patient.id, followUpId: f.id },
                    })
                  }
                />
              ))}
            </SurfaceCard>
          )
        }
      </QueryBoundary>
    </ScreenContainer>
  );
}
