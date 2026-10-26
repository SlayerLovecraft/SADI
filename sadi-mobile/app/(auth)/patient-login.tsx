import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';

export default function PatientLogin() {
  const { status, user, loginPatient } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => identifier.trim().length > 0 && password.length > 0 && !loading,
    [identifier, password, loading]
  );

  if (status === 'signedIn' && user?.role === 'patient') {
    return <Redirect href="/(patient)/dashboard" />;
  }

  const onSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    const res = await loginPatient(identifier, password);
    setLoading(false);
    if (!res.success) {
      Alert.alert('Error', res.error || 'No fue posible iniciar sesión');
      return;
    }
    router.replace('/(patient)/dashboard');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ECFEFF' }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>Portal Pacientes</Text>
        <Text style={{ fontSize: 14, color: '#0F766E', marginTop: 6 }}>
          Ingrese con número de documento o correo
        </Text>

        <View style={{ marginTop: 18, gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, color: '#0F766E' }}>Documento o Correo</Text>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              placeholder="1234567890 / correo@ejemplo.com"
              style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#99F6E4', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
            />
            <Text style={{ fontSize: 12, color: '#0F766E' }}>Por defecto es su número de cédula</Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, color: '#0F766E' }}>Contraseña</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#99F6E4', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
            />
          </View>

          <TouchableOpacity
            onPress={onSubmit}
            disabled={!canSubmit}
            style={{
              backgroundColor: canSubmit ? '#0EA5A4' : '#94A3B8',
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

