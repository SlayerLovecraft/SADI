import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="admin-login" />
      <Stack.Screen name="doctor-login" />
      <Stack.Screen name="patient-login" />
    </Stack>
  );
}

