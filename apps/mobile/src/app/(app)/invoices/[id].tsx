import { useLocalSearchParams } from 'expo-router';

import { InvoiceScreen } from '@/features/billing/InvoiceScreen';

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InvoiceScreen id={id} />;
}
