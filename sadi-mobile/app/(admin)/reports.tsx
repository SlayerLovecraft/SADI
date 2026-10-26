import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function ReportsScreen() {
  const { user } = useAuth();
  const hospitalId = user?.role === 'hospital_admin' ? user.hospitalId : null;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalCampaigns: 0,
    totalInteractions: 0,
    deliveryRate: 0,
  });

  const load = async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const patientsQuery = supabase.from('patients').select('patient_id', { count: 'exact', head: true }).eq('hospital_id', hospitalId);
      const campaignsQuery = supabase.from('campaigns').select('id, destinatarios, entregados', { count: 'exact' }).eq('hospital_id', hospitalId);
      const interactionsQuery = supabase.from('interactions').select('id', { count: 'exact', head: true }).eq('hospital_id', hospitalId);

      const [patientsRes, campaignsRes, interactionsRes] = await Promise.all([patientsQuery, campaignsQuery, interactionsQuery]);
      const campaigns = campaignsRes.data || [];
      const totalDestinatarios = campaigns.reduce((acc: number, c: any) => acc + (Number(c?.destinatarios) || 0), 0);
      const totalEntregados = campaigns.reduce((acc: number, c: any) => acc + (Number(c?.entregados) || 0), 0);
      const deliveryRate = totalDestinatarios > 0 ? Math.round((totalEntregados / totalDestinatarios) * 1000) / 10 : 0;

      setStats({
        totalPatients: patientsRes.count || 0,
        totalCampaigns: campaignsRes.count || 0,
        totalInteractions: interactionsRes.count || 0,
        deliveryRate,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [hospitalId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>Reportes</Text>
          <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Resumen del hospital</Text>
        </View>

        {loading ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: '#64748B' }}>Cargando...</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Row label="Total Pacientes" value={String(stats.totalPatients)} />
            <Row label="Total Campañas" value={String(stats.totalCampaigns)} />
            <Row label="Interacciones" value={String(stats.totalInteractions)} />
            <Row label="Tasa de Entrega" value={`${stats.deliveryRate.toFixed(1)}%`} />
            <View style={{ backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#DBEAFE' }}>
              <Text style={{ color: '#1E40AF', fontWeight: '700' }}>Exportación</Text>
              <Text style={{ color: '#1E40AF', marginTop: 6 }}>
                En móvil la exportación se gestiona como descarga/compartir archivo. Si deseas que quede idéntica al web (XLSX/PDF), se integra en una siguiente iteración.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: '#334155', fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: '#0F172A', fontWeight: '800', fontSize: 16 }}>{value}</Text>
    </View>
  );
}

