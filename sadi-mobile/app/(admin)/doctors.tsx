import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const specialtyOptions = [
  { value: 'cardiologo', label: 'Cardiólogo' },
  { value: 'obstetra', label: 'Obstetra' },
  { value: 'general', label: 'General' },
  { value: 'radiologo', label: 'Radiólogo' },
  { value: 'neurologico', label: 'Neurólogo' },
  { value: 'pediatra', label: 'Pediatra' },
  { value: 'traumatologo', label: 'Traumatólogo' },
  { value: 'ginecologo', label: 'Ginecólogo' },
  { value: 'oncologo', label: 'Oncólogo' },
  { value: 'dermatologo', label: 'Dermatólogo' },
];

type DoctorRow = {
  doctor_id: string;
  doctor_name: string | null;
  doctor_email: string;
  doctor_specialty: string | null;
  is_active: boolean | null;
  created_at?: string | null;
};

export default function DoctorsScreen() {
  const { user } = useAuth();
  const hospitalId = user?.role === 'hospital_admin' ? user.hospitalId : null;

  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<DoctorRow[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    especialidad: 'general',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('doctor_id, doctor_name, doctor_email, doctor_specialty, is_active, created_at')
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudieron cargar los doctores');
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
    return rows.filter((d) => {
      const email = String(d.doctor_email || '').toLowerCase();
      const nombre = String(d.doctor_name || '').toLowerCase();
      const esp = String(d.doctor_specialty || '').toLowerCase();
      return email.includes(term) || nombre.includes(term) || esp.includes(term);
    });
  }, [q, rows]);

  const createDoctor = async () => {
    if (!hospitalId) return;
    const email = form.email.trim().toLowerCase();
    if (!email || !form.password || !form.especialidad) {
      Alert.alert('Validación', 'Email, contraseña y especialidad son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        doctor_name: form.nombre ? String(form.nombre) : null,
        doctor_email: email,
        doctor_password: String(form.password),
        doctor_specialty: String(form.especialidad).trim().toLowerCase(),
        hospital_id: hospitalId,
        is_active: Boolean(form.is_active),
      };

      const { error } = await supabase.from('staff').insert([payload]);
      if (error) throw error;

      setForm({ nombre: '', email: '', password: '', especialidad: 'general', is_active: true });
      setShowForm(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo crear el doctor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>Doctores</Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Gestión de staff por hospital</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowForm((v) => !v)}
            style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#0F172A', borderRadius: 12 }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>{showForm ? 'Cerrar' : 'Agregar'}</Text>
          </TouchableOpacity>
        </View>

        {showForm ? (
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 }}>
            <Field label="Nombre" value={form.nombre} onChange={(v) => setForm((s) => ({ ...s, nombre: v }))} placeholder="Opcional" />
            <Field label="Email *" value={form.email} onChange={(v) => setForm((s) => ({ ...s, email: v }))} placeholder="doctor@hospital.com" autoCapitalize="none" />
            <Field label="Contraseña *" value={form.password} onChange={(v) => setForm((s) => ({ ...s, password: v }))} placeholder="Mínimo 8 caracteres" secureTextEntry />

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, color: '#334155' }}>Especialidad *</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {specialtyOptions.map((opt) => {
                  const active = form.especialidad === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setForm((s) => ({ ...s, especialidad: opt.value }))}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: active ? '#0F172A' : '#F1F5F9',
                      }}
                    >
                      <Text style={{ color: active ? 'white' : '#0F172A', fontSize: 12, fontWeight: '600' }}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              onPress={createDoctor}
              disabled={saving}
              style={{ marginTop: 6, paddingVertical: 12, backgroundColor: saving ? '#94A3B8' : '#0F172A', borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {saving ? <ActivityIndicator color="white" /> : null}
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Crear Doctor</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar por nombre, email o especialidad"
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
          keyExtractor={(item) => String(item.doctor_id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => <DoctorCard item={item} />}
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
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 12, color: '#334155' }}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize}
        style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
      />
    </View>
  );
}

function DoctorCard({ item }: { item: DoctorRow }) {
  const specialtyKey = String(item.doctor_specialty || '');
  const isActive = item.is_active !== false;
  return (
    <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{item.doctor_name || 'Sin nombre'}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{item.doctor_email}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' }}>
        <Tag text={specialtyKey || 'N/A'} />
        <Tag text={isActive ? 'Activo' : 'Inactivo'} tone={isActive ? 'ok' : 'muted'} />
      </View>
    </View>
  );
}

function Tag({ text, tone }: { text: string; tone?: 'ok' | 'muted' }) {
  const bg = tone === 'ok' ? '#DCFCE7' : '#F1F5F9';
  const fg = tone === 'ok' ? '#166534' : '#334155';
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

