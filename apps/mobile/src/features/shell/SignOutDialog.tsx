import { useRouter } from 'expo-router';

import { ConfirmDialog } from '@/components';
import { useSession } from '@/features/session/SessionProvider';

export function SignOutDialog() {
  const router = useRouter();
  const { signOut } = useSession();
  return (
    <ConfirmDialog
      title="Sign out?"
      message="You will need to sign in again to use HospitalOS on this device."
      confirmLabel="Sign out"
      destructive
      onCancel={() => router.back()}
      // The root layout's guard removes the protected area and returns to the entry route.
      onConfirm={signOut}
    />
  );
}
