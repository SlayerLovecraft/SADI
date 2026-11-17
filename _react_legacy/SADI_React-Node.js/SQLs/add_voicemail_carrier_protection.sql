-- ==============================================================================
-- SADI - PROTECCIÓN DUAL ANTI-BUZÓN, CERO COBRO CARRIER Y SMS OPENVOX 32P
-- 100% Sin Twilio: Telefonía y SMS corren exclusivamente sobre SIM Cards OpenVox
-- Seguro para ejecutarse incluso después de rollback parcial en scripts previos
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 0. Salvaguarda por si las tablas base aún no existen tras un rollback previo
CREATE TABLE IF NOT EXISTS public.vapi_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vapi_call_id TEXT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  doctor_id UUID NULL REFERENCES public.staff(doctor_id) ON DELETE SET NULL,
  telefono_llamado TEXT NOT NULL,
  motivo_llamada TEXT NOT NULL,
  estado_llamada TEXT NOT NULL DEFAULT 'programada',
  duracion_segundos INTEGER NOT NULL DEFAULT 0,
  contexto_inyectado JSONB NOT NULL DEFAULT '{}'::JSONB,
  transcripcion_completa TEXT NULL,
  resumen_ia TEXT NULL,
  sintomas_detectados TEXT[] NULL,
  cita_reagendada_at TIMESTAMPTZ NULL,
  escalado_a_enfermera BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_contact_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  canal TEXT NOT NULL CHECK (canal IN ('call_ia', 'whatsapp', 'sms')),
  motivo_contacto TEXT NOT NULL,
  telefono_destino TEXT NOT NULL,
  duracion_segundos INTEGER NOT NULL DEFAULT 0,
  grabacion_audio_url TEXT NULL,
  transcripcion_dialogo JSONB NOT NULL DEFAULT '[]'::JSONB,
  resumen_clinico_ia TEXT NOT NULL DEFAULT '',
  resultado_contacto TEXT NOT NULL DEFAULT 'no_contesta',
  paciente_confirmo_sintomas BOOLEAN NOT NULL DEFAULT FALSE,
  paciente_acepto_cita BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1. Ampliar public.vapi_agent_sessions con trazabilidad anti-buzón y ahorro de carrier
ALTER TABLE public.vapi_agent_sessions
  ADD COLUMN IF NOT EXISTS hospital_id UUID NULL,
  ADD COLUMN IF NOT EXISTS deteccion_buzon BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS capa_deteccion TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS cobro_carrier_evitado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sip_codigo_respuesta INTEGER NULL,
  ADD COLUMN IF NOT EXISTS motivo_corte TEXT NULL,
  ADD COLUMN IF NOT EXISTS confianza_amd NUMERIC(5,2) NULL,
  ADD COLUMN IF NOT EXISTS facturable_ips BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS costo_sadi_cop NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slot_tanda TEXT NULL,
  ADD COLUMN IF NOT EXISTS fallback_sms_enviado BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'vapi_agent_sessions'
      AND con.contype = 'c'
      AND (pg_get_constraintdef(con.oid) ILIKE '%estado_llamada%'
           OR pg_get_constraintdef(con.oid) ILIKE '%capa_deteccion%')
  LOOP
    EXECUTE format('ALTER TABLE public.vapi_agent_sessions DROP CONSTRAINT IF EXISTS %I', c_name);
  END LOOP;
END $$;

ALTER TABLE public.vapi_agent_sessions
  ADD CONSTRAINT vapi_agent_sessions_estado_llamada_check
  CHECK (estado_llamada IN (
    'programada',
    'en_curso',
    'completada',
    'fallida',
    'no_contesta',
    'buzon_cortado',
    'cancelada_pre_cobro'
  ));

ALTER TABLE public.vapi_agent_sessions
  ADD CONSTRAINT vapi_agent_sessions_capa_deteccion_check
  CHECK (capa_deteccion IN (
    'none',
    'pre_answer_sip_183',
    'ring_timeout_pre_answer',
    'vapi_amd_post_answer',
    'dtmf_human'
  ));

CREATE INDEX IF NOT EXISTS idx_vapi_sessions_hospital_created
  ON public.vapi_agent_sessions(hospital_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vapi_sessions_buzon
  ON public.vapi_agent_sessions(deteccion_buzon, cobro_carrier_evitado);

-- 2. Ampliar public.ai_contact_evidence con campos de corte sin costo
ALTER TABLE public.ai_contact_evidence
  ADD COLUMN IF NOT EXISTS deteccion_buzon BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS capa_deteccion TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS cobro_carrier_evitado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sip_codigo_respuesta INTEGER NULL,
  ADD COLUMN IF NOT EXISTS facturable_ips BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
DECLARE
  c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'ai_contact_evidence'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%resultado_contacto%'
  LOOP
    EXECUTE format('ALTER TABLE public.ai_contact_evidence DROP CONSTRAINT IF EXISTS %I', c_name);
  END LOOP;
END $$;

ALTER TABLE public.ai_contact_evidence
  ADD CONSTRAINT ai_contact_evidence_resultado_contacto_check
  CHECK (resultado_contacto IN (
    'contactado_exitoso',
    'requiere_intervencion_humana',
    'no_contesta',
    'numero_invalido',
    'llamada_interrumpida',
    'buzon_cortado_sin_cobro',
    'cancelada_pre_cobro'
  ));

-- 3. Configuración persistente de Anti-Buzón & Pre-Answer por Hospital (Sin Twilio)
CREATE TABLE IF NOT EXISTS public.ivr_anti_voicemail_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL UNIQUE,
  anti_voicemail_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  early_media_pre_answer BOOLEAN NOT NULL DEFAULT TRUE,
  pre_answer_ring_timeout_sec INTEGER NOT NULL DEFAULT 19 CHECK (pre_answer_ring_timeout_sec BETWEEN 10 AND 30),
  sip_cancel_on_183_voicemail BOOLEAN NOT NULL DEFAULT TRUE,
  voicemail_provider TEXT NOT NULL DEFAULT 'vapi' CHECK (voicemail_provider IN ('vapi', 'google', 'openai')),
  backoff_start_seconds NUMERIC(4,1) NOT NULL DEFAULT 1.5,
  backoff_frequency_seconds NUMERIC(4,1) NOT NULL DEFAULT 2.5 CHECK (backoff_frequency_seconds >= 2.5),
  backoff_max_retries INTEGER NOT NULL DEFAULT 3 CHECK (backoff_max_retries BETWEEN 1 AND 6),
  beep_max_await_seconds INTEGER NOT NULL DEFAULT 0 CHECK (beep_max_await_seconds BETWEEN 0 AND 30),
  voicemail_action TEXT NOT NULL DEFAULT 'hangup_silent' CHECK (voicemail_action IN ('hangup_silent', 'drop_message_last_try')),
  auto_requeue_next_tanda BOOLEAN NOT NULL DEFAULT TRUE,
  auto_sms_fallback_exhausted BOOLEAN NOT NULL DEFAULT TRUE,
  ari_gateway_host TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Infraestructura SMS por SIM Cards OpenVox (Puertos 1..32) + Failover & Purga Anti-Duplicado
CREATE TABLE IF NOT EXISTS public.openvox_gsm_ports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NULL,
  port_number INTEGER NOT NULL CHECK (port_number BETWEEN 1 AND 32),
  operator_name TEXT NOT NULL DEFAULT 'GSM',
  sim_iccid TEXT NULL,
  signal_rssi INTEGER NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  cooldown_until TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  last_sms_sent_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, port_number)
);

CREATE TABLE IF NOT EXISTS public.openvox_sms_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  campaign_id UUID NULL,
  patient_id UUID NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  hospital_id UUID NULL,
  to_phone TEXT NOT NULL,
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'aborted_purged', 'failed_all_ports')),
  winning_port INTEGER NULL,
  ports_attempted INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  purged_ports INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  gateway_message_id TEXT NULL,
  error_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.openvox_sms_attempt_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES public.openvox_sms_dispatches(id) ON DELETE CASCADE,
  port_number INTEGER NOT NULL CHECK (port_number BETWEEN 1 AND 32),
  attempt_order INTEGER NOT NULL DEFAULT 1,
  outcome TEXT NOT NULL CHECK (outcome IN ('sent', 'no_signal', 'modem_error', 'timeout', 'aborted_purged')),
  queue_purged BOOLEAN NOT NULL DEFAULT FALSE,
  raw_gateway_response TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_openvox_dispatches_status ON public.openvox_sms_dispatches(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_openvox_attempt_dispatch ON public.openvox_sms_attempt_logs(dispatch_id);

-- Ampliar campaign_messages de forma segura si ya existe para registrar puerto ganador OpenVox y purgas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaign_messages'
  ) THEN
    ALTER TABLE public.campaign_messages
      ADD COLUMN IF NOT EXISTS openvox_port INTEGER NULL,
      ADD COLUMN IF NOT EXISTS purged_ports INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
      ADD COLUMN IF NOT EXISTS gateway_message_id TEXT NULL;
  END IF;
END $$;

-- 5. Vista consolidada de auditoría y ahorro de cobro por carrier
CREATE OR REPLACE VIEW public.v_voicemail_carrier_savings AS
SELECT
  hospital_id,
  COUNT(*) FILTER (WHERE deteccion_buzon = TRUE) AS total_buzones_cortados,
  COUNT(*) FILTER (WHERE capa_deteccion = 'pre_answer_sip_183') AS cortes_sip_183_pre_answer,
  COUNT(*) FILTER (WHERE capa_deteccion = 'ring_timeout_pre_answer') AS cortes_timeout_pre_200ok,
  COUNT(*) FILTER (WHERE capa_deteccion = 'vapi_amd_post_answer') AS cortes_vapi_amd,
  COUNT(*) FILTER (WHERE cobro_carrier_evitado = TRUE) AS llamadas_cero_cobro_carrier,
  COUNT(*) FILTER (WHERE facturable_ips = FALSE) AS llamadas_excluidas_facturacion
FROM public.vapi_agent_sessions
GROUP BY hospital_id;

-- 6. Habilitar Realtime para sincronización automática de Tandas cuando vapi-webhook corta buzón
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'vapi_agent_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vapi_agent_sessions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 7. Habilitar acceso RLS y permisos de API (PostgREST / Realtime / Edge Functions)
DO $$
DECLARE
  t_name TEXT;
BEGIN
  FOREACH t_name IN ARRAY ARRAY[
    'vapi_agent_sessions',
    'ai_contact_evidence',
    'ivr_anti_voicemail_config',
    'openvox_gsm_ports',
    'openvox_sms_dispatches',
    'openvox_sms_attempt_logs',
    'rias_protocols_3280',
    'patient_clinical_documents'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t_name
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_name);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'sadi_app_access_' || t_name, t_name);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true)',
        'sadi_app_access_' || t_name,
        t_name
      );
      EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role', t_name);
    END IF;
  END LOOP;
END $$;

GRANT SELECT ON public.v_voicemail_carrier_savings TO anon, authenticated, service_role;
