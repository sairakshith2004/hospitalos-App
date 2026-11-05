import { useState } from 'react';

import { AppText, EmptyState, ScreenContainer, SearchField } from '@/components';

export function SearchScreen() {
  const [query, setQuery] = useState('');
  return (
    <ScreenContainer bottomInset={false}>
      <AppText variant="title" accessibilityRole="header">
        Search
      </AppText>
      <SearchField
        label="Search patients, staff or records"
        value={query}
        onChangeText={setQuery}
      />
      <EmptyState
        icon="search"
        title={query ? 'No results' : 'Search across HospitalOS'}
        message={
          query
            ? 'Search is not connected yet. Patient search arrives with Reception in Step 9.'
            : 'Results only include records your role is allowed to see.'
        }
      />
    </ScreenContainer>
  );
}
