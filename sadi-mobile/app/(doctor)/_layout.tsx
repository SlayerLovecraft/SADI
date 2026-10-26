import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

export default function DoctorLayout() {
  const { status, user } = useAuth();
  if (status === 'signedOut') return <Redirect href="/(auth)" />;
  if (status === 'signedIn' && user?.role !== 'doctor') return <Redirect href="/(auth)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}

