-- ==============================================================================
-- SADI · TRAZABILIDAD OMNICANAL DE RESPUESTAS DE CAMPAÑAS (SMS, LLAMADA, EMAIL, WA)
-- ==============================================================================
-- Registra cada envío de campaña por paciente y canal, clasificando la respuesta
-- real en:
--   - 'confirma_asistencia'  (1, Sí, Acepto, Puedo ir, Confirmo, etc.)
--   - 'no_puede_asistir'     (2, No, No puedo ir, Cancelar, Reprogramar, etc.)
--   - 'pendiente'            (Sin respuesta aún o no concluyente)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.campaign_channel_traceability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL DEFAULT '',
  patient_id UUID NULL REFERENCES public.patients(patient_id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL DEFAULT 'Paciente',
  patient_document TEXT NULL,
  contact_destination TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email', 'call')),
  delivery_status TEXT NOT NULL DEFAULT 'sent',
  response_status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (response_status IN ('confirma_asistencia', 'no_puede_asistir', 'pendiente')),
  response_raw TEXT NULL,
  external_ref_id TEXT NULL,
  inbound_msg_id TEXT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ NULL,
  responded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_camp_trace_campaign_channel
  ON public.campaign_channel_traceability (campaign_id, channel, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_camp_trace_dest_channel
  ON public.campaign_channel_traceability (contact_destination, channel, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_camp_trace_external_ref
  ON public.campaign_channel_traceability (external_ref_id)
  WHERE external_ref_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_camp_trace_external_ref_channel
  ON public.campaign_channel_traceability (channel, external_ref_id)
  WHERE external_ref_id IS NOT NULL AND external_ref_id <> '';

ALTER TABLE public.campaign_channel_traceability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sadi_app_access_campaign_channel_traceability
  ON public.campaign_channel_traceability;

CREATE POLICY sadi_app_access_campaign_channel_traceability
  ON public.campaign_channel_traceability
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE public.campaign_channel_traceability
  TO anon, authenticated, service_role;
