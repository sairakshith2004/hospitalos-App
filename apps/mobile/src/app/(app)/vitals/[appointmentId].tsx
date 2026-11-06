import { useLocalSearchParams } from 'expo-router';

import { VitalsScreen } from '@/features/clinical/VitalsScreen';

export default function Route() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  return <VitalsScreen appointmentId={appointmentId} />;
}
