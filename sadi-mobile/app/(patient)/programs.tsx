import { SafeAreaView, Text, View } from 'react-native';

export default function PatientPrograms() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ECFEFF' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>Mis Programas</Text>
        <Text style={{ marginTop: 8, color: '#0F766E' }}>Programas asignados.</Text>
      </View>
    </SafeAreaView>
  );
}

