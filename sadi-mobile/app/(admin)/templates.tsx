import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const categories = ['General', 'Recordatorios', 'Bienvenida', 'Seguimiento', 'Urgente'];

type TemplateRow = {
  id: string;
  nombre: string;
  mensaje: string;
  categoria: string | null;
  created_at?: string | null;
};

export default function TemplatesScreen() {
  const { user } = useAuth();
  const hospitalId = user?.role === 'hospital_admin' ? user.hospitalId : null;

  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<TemplateRow[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: '', mensaje: '', categoria: 'General' });

  const load = async () => {
    if (!hospitalId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('id, nombre, mensaje, categoria, created_at')
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudieron cargar las plantillas');
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
    return rows.filter((t) => {
      const n = String(t.nombre || '').toLowerCase();
      const m = String(t.mensaje || '').toLowerCase();
      const c = String(t.categoria || '').toLowerCase();
      return n.includes(term) || m.includes(term) || c.includes(term);
    });
  }, [q, rows]);

  const extractVariables = (message: string): string[] => {
    const allowed = new Set(['nombre', 'fecha_cita', 'hora_cita', 'programa', 'ciudad', 'hospital']);
    const regex = /\{+\s*([a-zA-Z_]+)\s*\}+/g;
    const out = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = regex.exec(message)) !== null) {
      const key = String(m[1] || '').trim().toLowerCase();
      if (allowed.has(key)) out.add(key);
    }
    return Array.from(out);
  };

  const createTemplate = async () => {
    if (!hospitalId) return;
    if (!form.nombre.trim() || !form.mensaje.trim()) {
      Alert.alert('Validación', 'Nombre y mensaje son requeridos');
      return;
    }
    setSaving(true);
    try {
      const variables = extractVariables(form.mensaje);
      const payload: any = {
        hospital_id: hospitalId,
        nombre: form.nombre.trim(),
        mensaje: form.mensaje.trim(),
        categoria: form.categoria || 'General',
        variables,
      };
      const { error } = await supabase.from('templates').insert([payload]);
      if (error) throw error;
      setForm({ nombre: '', mensaje: '', categoria: 'General' });
      setShowForm(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo crear la plantilla');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#0F172A' }}>Plantillas SMS</Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Mensajes reutilizables para campañas</Text>
          </View>
          <TouchableOpacity onPress={() => setShowForm((v) => !v)} style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#0F172A', borderRadius: 12 }}>
            <Text style={{ color: 'white', fontWeight: '600' }}>{showForm ? 'Cerrar' : 'Nueva'}</Text>
          </TouchableOpacity>
        </View>

        {showForm ? (
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 }}>
            <Field label="Nombre *" value={form.nombre} onChange={(v) => setForm((s) => ({ ...s, nombre: v }))} />
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, color: '#334155' }}>Categoría</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {categories.map((cat) => {
                  const active = form.categoria === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setForm((s) => ({ ...s, categoria: cat }))}
                      style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? '#0F172A' : '#F1F5F9' }}
                    >
                      <Text style={{ color: active ? 'white' : '#0F172A', fontSize: 12, fontWeight: '600' }}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, color: '#334155' }}>Mensaje *</Text>
              <TextInput
                value={form.mensaje}
                onChangeText={(v) => setForm((s) => ({ ...s, mensaje: v }))}
                multiline
                style={{ minHeight: 120, textAlignVertical: 'top', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}
                placeholder="Escribe el mensaje. Variables: {nombre}, {fecha_cita}, {hora_cita}, {programa}, {ciudad}, {hospital}"
              />
              <Text style={{ fontSize: 12, color: '#64748B' }}>Caracteres: {form.mensaje.length}</Text>
            </View>

            <TouchableOpacity
              onPress={createTemplate}
              disabled={saving}
              style={{ marginTop: 6, paddingVertical: 12, backgroundColor: saving ? '#94A3B8' : '#0F172A', borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {saving ? <ActivityIndicator color="white" /> : null}
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Crear Plantilla</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar (nombre, mensaje, categoría)"
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
          renderItem={({ item }) => <TemplateCard item={item} />}
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

function TemplateCard({ item }: { item: TemplateRow }) {
  const msg = String(item.mensaje || '');
  const preview = msg.length > 90 ? msg.slice(0, 90) + '…' : msg;
  return (
    <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{item.nombre}</Text>
      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{item.categoria || 'General'}</Text>
      <Text style={{ fontSize: 13, color: '#0F172A', marginTop: 10 }}>{preview}</Text>
    </View>
  );
}

