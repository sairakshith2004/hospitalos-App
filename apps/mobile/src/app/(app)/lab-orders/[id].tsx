import { useLocalSearchParams } from 'expo-router';

import { LabOrderScreen } from '@/features/lab/LabOrderScreen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LabOrderScreen id={id} />;
}
