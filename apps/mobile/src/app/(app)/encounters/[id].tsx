import { useLocalSearchParams } from 'expo-router';

import { EncounterScreen } from '@/features/clinical/EncounterScreen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EncounterScreen id={id} />;
}
