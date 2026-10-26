import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Redirect, Tabs } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

export default function AdminTabsLayout() {
  const { status, user } = useAuth();

  if (status === 'signedOut') return <Redirect href="/(auth)" />;
  if (status === 'signedIn' && user?.role !== 'hospital_admin') return <Redirect href="/(auth)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0F172A',
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <FontAwesome size={22} name="dashboard" color={color} /> }}
      />
      <Tabs.Screen
        name="patients"
        options={{ title: 'Pacientes', tabBarIcon: ({ color }) => <FontAwesome size={22} name="users" color={color} /> }}
      />
      <Tabs.Screen
        name="doctors"
        options={{ title: 'Doctores', tabBarIcon: ({ color }) => <FontAwesome size={22} name="user-md" color={color} /> }}
      />
      <Tabs.Screen
        name="segmentation"
        options={{ title: 'Segmentos', tabBarIcon: ({ color }) => <FontAwesome size={22} name="bullseye" color={color} /> }}
      />
      <Tabs.Screen
        name="templates"
        options={{ title: 'Plantillas', tabBarIcon: ({ color }) => <FontAwesome size={22} name="file-text" color={color} /> }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{ title: 'Campañas', tabBarIcon: ({ color }) => <FontAwesome size={22} name="send" color={color} /> }}
      />
      <Tabs.Screen
        name="interactions"
        options={{ title: 'Interacciones', tabBarIcon: ({ color }) => <FontAwesome size={22} name="comments" color={color} /> }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reportes', tabBarIcon: ({ color }) => <FontAwesome size={22} name="bar-chart" color={color} /> }}
      />
    </Tabs>
  );
}

