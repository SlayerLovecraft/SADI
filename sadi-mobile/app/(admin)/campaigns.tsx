import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type CampaignRow = {
  id: string;
  nombre: string | null;
  estado: string | null;
  created_at?: string | null;
  fecha_programada?: string | null;
  hora_programada?: string | null;
};

export default function CampaignsScreen() {
  const { user } = useAuth();
  const hospitalId = user?.role === 'hospital_admin' ? user.hospitalId : null;

  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CampaignRow[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: '', estado: 'En Progreso' });

  const load = async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, nombre, estado, created_at, fecha_programada, hora_programada')
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudieron cargar las campañas');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [hospitalId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((c) => String(c.nombre || '').toLowerCase().includes(term) || String(c.estado || '').toLowerCase().includes(term));
  }, [q, rows]);

  const createCampaign = async () => {
    if (!hospitalId) return;
    if (!form.nombre.trim()) {
      Alert.alert('Validación', 'El nombre es requerido');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        hospital_id: hospitalId,
        nombre: form.nombre.trim(),
        estado: form.estado || 'En Progreso',
      };
      const { error } = await supabase.from('campaigns').insert([payload]);
      if (error) throw error;
      setForm({ nombre: '', estado: 'En Progreso' });
      setShowForm(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo crear la campaña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>Campañas</Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Gestión de campañas</Text>
          </View>
          <TouchableOpacity onPress={() => setShowForm((v) => !v)} style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#0F172A', borderRadius: 12 }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>{showForm ? 'Cerrar' : 'Nueva'}</Text>
          </TouchableOpacity>
        </View>

        {showForm ? (
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 }}>
            <Field label="Nombre *" value={form.nombre} onChange={(v) => setForm((s) => ({ ...s, nombre: v }))} />
            <Field label="Estado" value={form.estado} onChange={(v) => setForm((s) => ({ ...s, estado: v }))} />
            <TouchableOpacity
              onPress={createCampaign}
              disabled={saving}
              style={{ marginTop: 6, paddingVertical: 12, backgroundColor: saving ? '#94A3B8' : '#0F172A', borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {saving ? <ActivityIndicator color="white" /> : null}
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Crear Campaña</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar (nombre, estado)"
            style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }}
          />
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: '#64748B' }}>Cargando...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => <CampaignCard item={item} />}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#64748B', padding: 24 }}>Sin resultados</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 12, color: '#334155' }}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
      />
    </View>
  );
}

function CampaignCard({ item }: { item: CampaignRow }) {
  const estado = item.estado || 'N/A';
  return (
    <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{item.nombre || 'Sin nombre'}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>{estado}</Text>
    </View>
  );
}

