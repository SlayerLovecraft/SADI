import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const hospitalId = user?.role === 'hospital_admin' ? user.hospitalId : null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalPatients: 0,
    activeCampaigns: 0,
    totalInteractions: 0,
    deliveryRate: 0,
  });

  const title = useMemo(() => user?.role === 'hospital_admin' ? (user.hospital_name || 'Hospital') : 'Dashboard', [user]);

  const load = async (showSpinner: boolean) => {
    if (!hospitalId) return;
    if (showSpinner) setLoading(true);
    try {
      const patientsQuery = supabase.from('patients').select('patient_id', { count: 'exact', head: true }).eq('hospital_id', hospitalId);
      const campaignsQuery = supabase.from('campaigns').select('id, estado, destinatarios, entregados', { count: 'exact' }).eq('hospital_id', hospitalId);
      const interactionsQuery = supabase.from('interactions').select('id', { count: 'exact', head: true }).eq('hospital_id', hospitalId);

      const [patientsRes, campaignsRes, interactionsRes] = await Promise.all([patientsQuery, campaignsQuery, interactionsQuery]);

      const totalPatients = patientsRes.count || 0;
      const totalInteractions = interactionsRes.count || 0;

      const campaigns = campaignsRes.data || [];
      const activeCampaigns = campaigns.filter((c: any) => String(c?.estado || '').toLowerCase() !== 'completada').length;
      const totalDestinatarios = campaigns.reduce((acc: number, c: any) => acc + (Number(c?.destinatarios) || 0), 0);
      const totalEntregados = campaigns.reduce((acc: number, c: any) => acc + (Number(c?.entregados) || 0), 0);
      const deliveryRate = totalDestinatarios > 0 ? Math.round((totalEntregados / totalDestinatarios) * 1000) / 10 : 0;

      setStats({ totalPatients, activeCampaigns, totalInteractions, deliveryRate });
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
  }, [hospitalId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>{title}</Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Vista general del sistema</Text>
            </View>
            <TouchableOpacity onPress={logout} style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#0F172A', borderRadius: 12 }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>Salir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: '#64748B' }}>Cargando...</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Card label="Total Pacientes" value={String(stats.totalPatients)} />
              <Card label="Campañas Activas" value={String(stats.activeCampaigns)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Card label="Interacciones" value={String(stats.totalInteractions)} />
              <Card label="Tasa de Entrega" value={`${stats.deliveryRate.toFixed(1)}%`} />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
      <Text style={{ fontSize: 12, color: '#64748B' }}>{label}</Text>
      <Text style={{ marginTop: 8, fontSize: 24, fontWeight: '800', color: '#0F172A' }}>{value}</Text>
    </View>
  );
}

