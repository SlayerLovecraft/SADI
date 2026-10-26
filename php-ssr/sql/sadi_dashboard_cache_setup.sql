CREATE TABLE IF NOT EXISTS public.dashboard_stats_cache (
  hospital_id uuid PRIMARY KEY,
  total_patients bigint NOT NULL DEFAULT 0,
  active_campaigns bigint NOT NULL DEFAULT 0,
  total_interactions bigint NOT NULL DEFAULT 0,
  total_destinatarios bigint NOT NULL DEFAULT 0,
  total_entregados bigint NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_stats_cache_refreshed_at
ON public.dashboard_stats_cache (refreshed_at DESC);

ANALYZE public.dashboard_stats_cache;
