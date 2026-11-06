import { useLocalSearchParams } from 'expo-router';

import { PatientScreen } from '@/features/patients/PatientScreen';

export default function PatientRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PatientScreen id={id} />;
}
