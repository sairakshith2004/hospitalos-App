import { Redirect } from 'expo-router';

import { useSession } from '@/features/session/SessionProvider';

/** Entry point: decides where the app opens. */
export default function Index() {
  const { state, introSeen } = useSession();
  if (state.status === 'signed-in') return <Redirect href="/home" />;
  return <Redirect href={introSeen ? '/sign-in' : '/splash'} />;
}
