import { useLocalSearchParams } from 'expo-router';

import { DispenseScreen } from '@/features/pharmacy/DispenseScreen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DispenseScreen id={id} />;
}
