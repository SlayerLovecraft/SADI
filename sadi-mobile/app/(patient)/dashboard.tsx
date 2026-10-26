import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';

export default function PatientDashboard() {
  const { user, logout } = useAuth();
  const name = user?.role === 'patient' ? (user.nombre || user.documento) : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ECFEFF' }}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#99F6E4' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>Portal del Paciente</Text>
              <Text style={{ fontSize: 12, color: '#0F766E', marginTop: 4 }}>{name}</Text>
            </View>
            <TouchableOpacity onPress={logout} style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#0EA5A4', borderRadius: 12 }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>Salir</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ backgroundColor: '#CCFBF1', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#99F6E4' }}>
          <Text style={{ color: '#0F766E', fontWeight: '700' }}>Portapapeles</Text>
          <Text style={{ color: '#0F766E', marginTop: 6 }}>
            Dashboard y signos vitales del paciente (equivalente al portal web). Las pantallas de Salud/Agenda/Historia/Interacciones ya están en navegación y se completan con el mismo origen de datos (Supabase).
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

