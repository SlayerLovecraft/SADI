import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type PatientRow = {
  patient_id: string;
  name: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  program: string | null;
  city: string | null;
  created_at?: string | null;
};

export default function PatientsScreen() {
  const { user } = useAuth();
  const hospitalId = user?.role === 'hospital_admin' ? user.hospitalId : null;

  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<PatientRow[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    document: '',
    phone: '',
    email: '',
    city: '',
    program: '',
  });

  const load = async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('patient_id, name, document, phone, email, city, program, created_at')
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudieron cargar los pacientes');
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
    return rows.filter((p) => {
      const name = String(p.name || '').toLowerCase();
      const doc = String(p.document || '').toLowerCase();
      const email = String(p.email || '').toLowerCase();
      const phone = String(p.phone || '').toLowerCase();
      return name.includes(term) || doc.includes(term) || email.includes(term) || phone.includes(term);
    });
  }, [q, rows]);

  const createPatient = async () => {
    if (!hospitalId) return;
    if (!form.name.trim() || !form.document.trim()) {
      Alert.alert('Validación', 'Nombre y documento son requeridos');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        hospital_id: hospitalId,
        name: form.name.trim(),
        document: form.document.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim().toLowerCase() || null,
        city: form.city.trim() || null,
        program: form.program.trim() || null,
      };
      const { error } = await supabase.from('patients').insert([payload]);
      if (error) throw error;
      setForm({ name: '', document: '', phone: '', email: '', city: '', program: '' });
      setShowForm(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo crear el paciente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>Pacientes</Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Registro y consulta</Text>
          </View>
          <TouchableOpacity onPress={() => setShowForm((v) => !v)} style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#0F172A', borderRadius: 12 }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>{showForm ? 'Cerrar' : 'Nuevo'}</Text>
          </TouchableOpacity>
        </View>

        {showForm ? (
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 }}>
            <Field label="Nombre *" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} />
            <Field label="Documento *" value={form.document} onChange={(v) => setForm((s) => ({ ...s, document: v }))} autoCapitalize="none" />
            <Field label="Teléfono" value={form.phone} onChange={(v) => setForm((s) => ({ ...s, phone: v }))} autoCapitalize="none" />
            <Field label="Email" value={form.email} onChange={(v) => setForm((s) => ({ ...s, email: v }))} autoCapitalize="none" />
            <Field label="Ciudad" value={form.city} onChange={(v) => setForm((s) => ({ ...s, city: v }))} />
            <Field label="Programa" value={form.program} onChange={(v) => setForm((s) => ({ ...s, program: v }))} />

            <TouchableOpacity
              onPress={createPatient}
              disabled={saving}
              style={{ marginTop: 6, paddingVertical: 12, backgroundColor: saving ? '#94A3B8' : '#0F172A', borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {saving ? <ActivityIndicator color="white" /> : null}
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Crear Paciente</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar (nombre, documento, email, teléfono)"
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
          keyExtractor={(item) => String(item.patient_id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => <PatientCard item={item} />}
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

function PatientCard({ item }: { item: PatientRow }) {
  return (
    <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{item.name || 'Sin nombre'}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
        Doc: {item.document || '-'} · Tel: {item.phone || '-'}
      </Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
        {item.program || 'Sin programa'} · {item.city || 'Sin ciudad'}
      </Text>
    </View>
  );
}

