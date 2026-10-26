import { Redirect, router } from 'expo-router';
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';

export default function AuthHome() {
  const { status, user } = useAuth();

  if (status === 'signedIn' && user) {
    if (user.role === 'hospital_admin') return <Redirect href="/(admin)/dashboard" />;
    if (user.role === 'doctor') return <Redirect href="/(doctor)/dashboard" />;
    return <Redirect href="/(patient)/dashboard" />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <View style={{ gap: 8, marginBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#0F172A' }}>SADI</Text>
          <Text style={{ fontSize: 14, color: '#64748B' }}>Sistema de Apoyo para Demanda Inducida</Text>
        </View>

        <View style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/admin-login')}
            style={{ backgroundColor: '#0F172A', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Portal Administrativo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/doctor-login')}
            style={{ backgroundColor: 'white', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}
          >
            <Text style={{ color: '#0F172A', fontSize: 16, fontWeight: '600' }}>Portal Doctores</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/patient-login')}
            style={{ backgroundColor: '#0EA5A4', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Portal Pacientes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

