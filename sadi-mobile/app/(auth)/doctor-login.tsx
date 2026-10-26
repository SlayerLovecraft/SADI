import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';

export default function DoctorLogin() {
  const { status, user, loginDoctor } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => email.trim().length > 0 && password.length > 0 && !loading, [email, password, loading]);

  if (status === 'signedIn' && user?.role === 'doctor') {
    return <Redirect href="/(doctor)/dashboard" />;
  }

  const onSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    const res = await loginDoctor(email, password);
    setLoading(false);
    if (!res.success) {
      Alert.alert('Error', res.error || 'No fue posible iniciar sesión');
      return;
    }
    router.replace('/(doctor)/dashboard');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>Portal Doctores</Text>
        <Text style={{ fontSize: 14, color: '#64748B', marginTop: 6 }}>Ingrese con su correo</Text>

        <View style={{ marginTop: 18, gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, color: '#334155' }}>Correo</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="doctor@hospital.com"
              style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, color: '#334155' }}>Contraseña</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
            />
          </View>

          <TouchableOpacity
            onPress={onSubmit}
            disabled={!canSubmit}
            style={{
              backgroundColor: canSubmit ? '#0F172A' : '#94A3B8',
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading ? <ActivityIndicator color="white" /> : null}
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Ingresar</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={{ paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ color: '#0F172A' }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

