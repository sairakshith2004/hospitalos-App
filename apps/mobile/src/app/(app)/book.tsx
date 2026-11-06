import { useLocalSearchParams } from 'expo-router';

import { BookScreen } from '@/features/reception/BookScreen';

export default function BookRoute() {
  const { patientId, followUpId } = useLocalSearchParams<{
    patientId: string;
    followUpId?: string;
  }>();
  return <BookScreen patientId={patientId} followUpId={followUpId} />;
}
