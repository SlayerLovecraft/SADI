import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Redirect, Tabs } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

export default function PatientTabsLayout() {
  const { status, user } = useAuth();
  if (status === 'signedOut') return <Redirect href="/(auth)" />;
  if (status === 'signedIn' && user?.role !== 'patient') return <Redirect href="/(auth)" />;

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#0F766E' }}>
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Inicio', tabBarIcon: ({ color }) => <FontAwesome size={22} name="home" color={color} /> }}
      />
      <Tabs.Screen
        name="health"
        options={{ title: 'Salud', tabBarIcon: ({ color }) => <FontAwesome size={22} name="heartbeat" color={color} /> }}
      />
      <Tabs.Screen
        name="schedule"
        options={{ title: 'Agenda', tabBarIcon: ({ color }) => <FontAwesome size={22} name="calendar" color={color} /> }}
      />
      <Tabs.Screen
        name="programs"
        options={{ title: 'Programas', tabBarIcon: ({ color }) => <FontAwesome size={22} name="list" color={color} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'Historia', tabBarIcon: ({ color }) => <FontAwesome size={22} name="file-text" color={color} /> }}
      />
      <Tabs.Screen
        name="interactions"
        options={{ title: 'Soporte', tabBarIcon: ({ color }) => <FontAwesome size={22} name="comments" color={color} /> }}
      />
    </Tabs>
  );
}

