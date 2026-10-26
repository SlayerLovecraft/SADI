import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const name = user?.role === 'doctor' ? (user.nombre || user.email) : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>Dashboard Doctor</Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{name}</Text>
            </View>
            <TouchableOpacity onPress={logout} style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#0F172A', borderRadius: 12 }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>Salir</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#DBEAFE' }}>
          <Text style={{ color: '#1E40AF', fontWeight: '700' }}>Módulo Doctor</Text>
          <Text style={{ color: '#1E40AF', marginTop: 6 }}>
            Incluye pacientes asignados, cronograma y reportes. Se mantiene la misma estructura funcional del React legacy y se completa en siguientes iteraciones.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

