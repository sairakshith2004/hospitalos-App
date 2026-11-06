import { useLocalSearchParams } from 'expo-router';

import { ChartScreen } from '@/features/patients/ChartScreen';

export default function ChartRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChartScreen id={id} />;
}
