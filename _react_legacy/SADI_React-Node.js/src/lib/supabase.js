// @/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Faltan variables de entorno de Supabase')
  console.log('VITE_SUPABASE_URL:', supabaseUrl ? '✅ Definida' : '❌ No definida')
  console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Definida' : '❌ No definida')
}

const createTimeoutFetch = (baseFetch, timeoutMs) => {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const upstreamSignal = init?.signal;
    if (upstreamSignal) {
      if (upstreamSignal.aborted) controller.abort();
      else upstreamSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };
};

const supabaseFetch =
  typeof fetch === 'function' ? createTimeoutFetch(fetch, 15000) : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: supabaseFetch ? { fetch: supabaseFetch } : undefined,
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public'
  }
})

// Función de prueba de conexión
export const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('count')
      .limit(1)
    
    if (error) throw error
    console.log('✅ Conexión a Supabase exitosa')
    return true
  } catch (error) {
    console.error('❌ Error de conexión a Supabase:', error)
    return false
  }
}
