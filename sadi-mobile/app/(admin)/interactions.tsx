import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type InteractionRow = {
  id: string;
  tipo: string | null;
  estado: string | null;
  prioridad: string | null;
  asunto: string | null;
  mensaje: string | null;
  created_at?: string | null;
  patient_id?: string | null;
  patient_name?: string | null;
  patient_phone?: string | null;
  patient_email?: string | null;
};

export default function InteractionsScreen() {
  const { user } = useAuth();
  const hospitalId = user?.role === 'hospital_admin' ? user.hospitalId : null;

  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<InteractionRow[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: 'Consulta',
    asunto: '',
    mensaje: '',
    prioridad: 'media',
    estado: 'abierta',
    patient_name: '',
    patient_phone: '',
    patient_email: '',
  });

  const load = async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('interactions')
        .select('id, tipo, estado, prioridad, asunto, mensaje, created_at, patient_id, patient_name, patient_phone, patient_email')
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudieron cargar las interacciones');
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
    return rows.filter((i) => {
      const asunto = String(i.asunto || '').toLowerCase();
      const mensaje = String(i.mensaje || '').toLowerCase();
      const paciente = String(i.patient_name || '').toLowerCase();
      return asunto.includes(term) || mensaje.includes(term) || paciente.includes(term);
    });
  }, [q, rows]);

  const createInteraction = async () => {
    if (!hospitalId) return;
    if (!form.asunto.trim() || !form.mensaje.trim()) {
      Alert.alert('Validación', 'Asunto y mensaje son requeridos');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        hospital_id: hospitalId,
        tipo: form.tipo,
        asunto: form.asunto.trim(),
        mensaje: form.mensaje.trim(),
        prioridad: form.prioridad,
        estado: form.estado,
        patient_name: form.patient_name.trim() || null,
        patient_phone: form.patient_phone.trim() || null,
        patient_email: form.patient_email.trim().toLowerCase() || null,
      };
      const { error } = await supabase.from('interactions').insert([payload]);
      if (error) throw error;
      setForm({ tipo: 'Consulta', asunto: '', mensaje: '', prioridad: 'media', estado: 'abierta', patient_name: '', patient_phone: '', patient_email: '' });
      setShowForm(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo crear la interacción');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>Interacciones</Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Registro manual de PQRS o mensajes</Text>
          </View>
          <TouchableOpacity onPress={() => setShowForm((v) => !v)} style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#0F172A', borderRadius: 12 }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>{showForm ? 'Cerrar' : 'Nueva'}</Text>
          </TouchableOpacity>
        </View>

        {showForm ? (
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 }}>
            <Field label="Tipo" value={form.tipo} onChange={(v) => setForm((s) => ({ ...s, tipo: v }))} />
            <Field label="Prioridad" value={form.prioridad} onChange={(v) => setForm((s) => ({ ...s, prioridad: v }))} />
            <Field label="Estado" value={form.estado} onChange={(v) => setForm((s) => ({ ...s, estado: v }))} />
            <Field label="Paciente (nombre)" value={form.patient_name} onChange={(v) => setForm((s) => ({ ...s, patient_name: v }))} />
            <Field label="Paciente (teléfono)" value={form.patient_phone} onChange={(v) => setForm((s) => ({ ...s, patient_phone: v }))} autoCapitalize="none" />
            <Field label="Paciente (email)" value={form.patient_email} onChange={(v) => setForm((s) => ({ ...s, patient_email: v }))} autoCapitalize="none" />
            <Field label="Asunto *" value={form.asunto} onChange={(v) => setForm((s) => ({ ...s, asunto: v }))} />

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, color: '#334155' }}>Mensaje *</Text>
              <TextInput
                value={form.mensaje}
                onChangeText={(v) => setForm((s) => ({ ...s, mensaje: v }))}
                multiline
                style={{ minHeight: 120, textAlignVertical: 'top', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
              />
            </View>

            <TouchableOpacity
              onPress={createInteraction}
              disabled={saving}
              style={{ marginTop: 6, paddingVertical: 12, backgroundColor: saving ? '#94A3B8' : '#0F172A', borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {saving ? <ActivityIndicator color="white" /> : null}
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Crear Interacción</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar (asunto, mensaje, paciente)"
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
          renderItem={({ item }) => <InteractionCard item={item} />}
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

function InteractionCard({ item }: { item: InteractionRow }) {
  const msg = String(item.mensaje || '');
  const preview = msg.length > 90 ? msg.slice(0, 90) + '…' : msg;
  const patient = item.patient_name ? String(item.patient_name) : '';
  return (
    <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{item.asunto || 'Sin asunto'}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>
        {item.tipo || 'N/A'} · {item.estado || 'N/A'} · {item.prioridad || 'N/A'}{patient ? ` · ${patient}` : ''}
      </Text>
      <Text style={{ fontSize: 13, color: '#0F172A', marginTop: 10 }}>{preview}</Text>
    </View>
  );
}

