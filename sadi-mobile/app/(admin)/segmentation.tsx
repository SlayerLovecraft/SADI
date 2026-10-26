import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type SegmentRow = {
  id: string;
  nombre: string;
  edad_min: number | null;
  edad_max: number | null;
  sexo: string | null;
  ciudad: string | null;
  programa: string | null;
  created_at?: string | null;
};

export default function SegmentationScreen() {
  const { user } = useAuth();
  const hospitalId = user?.role === 'hospital_admin' ? user.hospitalId : null;

  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<SegmentRow[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    edad_min: '',
    edad_max: '',
    sexo: 'Todos',
    ciudad: '',
    programa: '',
  });

  const load = async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('segments')
        .select('id, nombre, edad_min, edad_max, sexo, ciudad, programa, created_at')
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudieron cargar los segmentos');
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
    return rows.filter((s) => {
      const nombre = String(s.nombre || '').toLowerCase();
      const ciudad = String(s.ciudad || '').toLowerCase();
      const programa = String(s.programa || '').toLowerCase();
      return nombre.includes(term) || ciudad.includes(term) || programa.includes(term);
    });
  }, [q, rows]);

  const createSegment = async () => {
    if (!hospitalId) return;
    if (!form.nombre.trim()) {
      Alert.alert('Validación', 'El nombre es requerido');
      return;
    }
    if (form.edad_min && !/^\d+$/.test(form.edad_min)) {
      Alert.alert('Validación', 'Edad mínima inválida');
      return;
    }
    if (form.edad_max && !/^\d+$/.test(form.edad_max)) {
      Alert.alert('Validación', 'Edad máxima inválida');
      return;
    }
    if (form.edad_min && form.edad_max && Number(form.edad_min) > Number(form.edad_max)) {
      Alert.alert('Validación', 'Edad mínima no puede ser mayor que edad máxima');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        hospital_id: hospitalId,
        nombre: form.nombre.trim(),
        edad_min: form.edad_min ? Number(form.edad_min) : null,
        edad_max: form.edad_max ? Number(form.edad_max) : null,
        sexo: form.sexo || 'Todos',
        ciudad: form.ciudad.trim() || null,
        programa: form.programa.trim() || null,
      };
      const { error } = await supabase.from('segments').insert([payload]);
      if (error) throw error;
      setForm({ nombre: '', edad_min: '', edad_max: '', sexo: 'Todos', ciudad: '', programa: '' });
      setShowForm(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo crear el segmento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>Segmentación</Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Crea segmentos para campañas</Text>
          </View>
          <TouchableOpacity onPress={() => setShowForm((v) => !v)} style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#0F172A', borderRadius: 12 }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>{showForm ? 'Cerrar' : 'Nuevo'}</Text>
          </TouchableOpacity>
        </View>

        {showForm ? (
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 }}>
            <Field label="Nombre *" value={form.nombre} onChange={(v) => setForm((s) => ({ ...s, nombre: v }))} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Edad mínima" value={form.edad_min} onChange={(v) => setForm((s) => ({ ...s, edad_min: v }))} autoCapitalize="none" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Edad máxima" value={form.edad_max} onChange={(v) => setForm((s) => ({ ...s, edad_max: v }))} autoCapitalize="none" />
              </View>
            </View>
            <Field label="Sexo" value={form.sexo} onChange={(v) => setForm((s) => ({ ...s, sexo: v }))} />
            <Field label="Ciudad" value={form.ciudad} onChange={(v) => setForm((s) => ({ ...s, ciudad: v }))} />
            <Field label="Programa" value={form.programa} onChange={(v) => setForm((s) => ({ ...s, programa: v }))} />

            <TouchableOpacity
              onPress={createSegment}
              disabled={saving}
              style={{ marginTop: 6, paddingVertical: 12, backgroundColor: saving ? '#94A3B8' : '#0F172A', borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {saving ? <ActivityIndicator color="white" /> : null}
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Crear Segmento</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar (nombre, ciudad, programa)"
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
          renderItem={({ item }) => <SegmentCard item={item} />}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#64748B', padding: 24 }}>Sin resultados</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 12, color: '#334155' }}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        autoCapitalize={props.autoCapitalize}
        style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
      />
    </View>
  );
}

function SegmentCard({ item }: { item: SegmentRow }) {
  const parts: string[] = [];
  if (item.edad_min !== null || item.edad_max !== null) parts.push(`Edad: ${item.edad_min ?? ''}-${item.edad_max ?? ''}`);
  if (item.sexo && item.sexo.toLowerCase() !== 'todos') parts.push(`Sexo: ${item.sexo}`);
  if (item.ciudad) parts.push(`Ciudad: ${item.ciudad}`);
  if (item.programa) parts.push(`Programa: ${item.programa}`);
  const criteria = parts.length ? parts.join(' · ') : 'Sin criterios';
  return (
    <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{item.nombre}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>{criteria}</Text>
    </View>
  );
}

