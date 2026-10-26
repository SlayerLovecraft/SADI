import { SafeAreaView, Text, View } from 'react-native';

export default function PatientHistory() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ECFEFF' }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>Historia Clínica</Text>
        <Text style={{ marginTop: 8, color: '#0F766E' }}>Documentos e historial.</Text>
      </View>
    </SafeAreaView>
  );
}

