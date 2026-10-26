<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Infrastructure\Db;

final class DashboardRepository
{
    private Db $db;
    private int $cacheTtlSeconds;

    public function __construct(Db $db, int $cacheTtlSeconds = 60)
    {
        $this->db = $db;
        $this->cacheTtlSeconds = max(5, $cacheTtlSeconds);
    }

    public function getHospitalStats(string $hospitalId): array
    {
        try {
            $cached = $this->db->fetchOne(
                'SELECT hospital_id, total_patients, active_campaigns, total_interactions, total_destinatarios, total_entregados, refreshed_at
                 FROM public.dashboard_stats_cache
                 WHERE hospital_id = :hospital_id
                 LIMIT 1',
                ['hospital_id' => $hospitalId]
            );

            if ($cached && $this->isCacheFresh($cached['refreshed_at'] ?? null)) {
                $base = $this->normalizeStatsRow($cached);
                return array_merge($base, $this->getDashboardBreakdowns($hospitalId));
            }
        } catch (\Throwable $e) {
        }

        $computed = $this->computeHospitalStats($hospitalId);
        $computed = array_merge($computed, $this->getDashboardBreakdowns($hospitalId));

        try {
            $this->db->execute(
                'INSERT INTO public.dashboard_stats_cache (hospital_id, total_patients, active_campaigns, total_interactions, total_destinatarios, total_entregados, refreshed_at)
                 VALUES (:hospital_id, :total_patients, :active_campaigns, :total_interactions, :total_destinatarios, :total_entregados, now())
                 ON CONFLICT (hospital_id) DO UPDATE SET
                   total_patients = EXCLUDED.total_patients,
                   active_campaigns = EXCLUDED.active_campaigns,
                   total_interactions = EXCLUDED.total_interactions,
                   total_destinatarios = EXCLUDED.total_destinatarios,
                   total_entregados = EXCLUDED.total_entregados,
                   refreshed_at = now()',
                [
                    'hospital_id' => $hospitalId,
                    'total_patients' => (int)$computed['total_patients'],
                    'active_campaigns' => (int)$computed['active_campaigns'],
                    'total_interactions' => (int)$computed['total_interactions'],
                    'total_destinatarios' => (int)$computed['total_destinatarios'],
                    'total_entregados' => (int)$computed['total_entregados'],
                ]
            );
        } catch (\Throwable $e) {
        }

        return $computed;
    }

    private function getDashboardBreakdowns(string $hospitalId): array
    {
        return [
            'campaign_status' => $this->getCampaignStatusBreakdown($hospitalId),
            'demographics' => $this->getDemographicsBreakdown($hospitalId),
        ];
    }

    private function getCampaignStatusBreakdown(string $hospitalId): array
    {
        $out = [
            'en_progreso' => 0,
            'completadas' => 0,
            'programadas' => 0,
            'total' => 0,
        ];

        try {
            $rows = $this->db->fetchAll(
                'SELECT lower(COALESCE(estado, \'\')) AS status, COUNT(*)::bigint AS n
                 FROM public.campaigns
                 WHERE hospital_id = :hospital_id
                 GROUP BY lower(COALESCE(estado, \'\'))',
                ['hospital_id' => $hospitalId]
            );
        } catch (\Throwable $e) {
            return $out;
        }

        foreach ($rows as $r) {
            $status = (string)($r['status'] ?? '');
            $n = (int)($r['n'] ?? 0);
            if ($n <= 0) continue;
            $out['total'] += $n;

            if (in_array($status, ['completada', 'completed', 'finalizada', 'finalizado'], true)) {
                $out['completadas'] += $n;
                continue;
            }
            if (in_array($status, ['programada', 'programado', 'scheduled'], true)) {
                $out['programadas'] += $n;
                continue;
            }

            $out['en_progreso'] += $n;
        }

        return $out;
    }

    private function getDemographicsBreakdown(string $hospitalId): array
    {
        $out = [
            'hombres' => 0,
            'mujeres' => 0,
            'ninos' => 0,
            'ninas' => 0,
            'total' => 0,
        ];

        try {
            $row = $this->db->fetchOne(
                'WITH p AS (
                   SELECT
                     lower(COALESCE(sex, \'\')) AS sex,
                     birthdate
                   FROM public.patients
                   WHERE hospital_id = :hospital_id
                 ),
                 a AS (
                   SELECT
                     COUNT(*) FILTER (WHERE birthdate IS NOT NULL AND date_part(\'year\', age(birthdate)) < 18 AND sex IN (\'m\', \'masculino\', \'hombre\'))::bigint AS ninos,
                     COUNT(*) FILTER (WHERE birthdate IS NOT NULL AND date_part(\'year\', age(birthdate)) < 18 AND sex IN (\'f\', \'femenino\', \'mujer\'))::bigint AS ninas,
                     COUNT(*) FILTER (WHERE (birthdate IS NULL OR date_part(\'year\', age(birthdate)) >= 18) AND sex IN (\'m\', \'masculino\', \'hombre\'))::bigint AS hombres,
                     COUNT(*) FILTER (WHERE (birthdate IS NULL OR date_part(\'year\', age(birthdate)) >= 18) AND sex IN (\'f\', \'femenino\', \'mujer\'))::bigint AS mujeres,
                     COUNT(*)::bigint AS total
                   FROM p
                 )
                 SELECT hombres, mujeres, ninos, ninas, total FROM a',
                ['hospital_id' => $hospitalId]
            );
        } catch (\Throwable $e) {
            return $out;
        }

        if (!$row) return $out;
        $out['hombres'] = (int)($row['hombres'] ?? 0);
        $out['mujeres'] = (int)($row['mujeres'] ?? 0);
        $out['ninos'] = (int)($row['ninos'] ?? 0);
        $out['ninas'] = (int)($row['ninas'] ?? 0);
        $out['total'] = (int)($row['total'] ?? 0);
        return $out;
    }

    public function getRecentCampaigns(string $hospitalId, int $limit = 5): array
    {
        $limit = min(max(1, $limit), 20);
        return $this->db->fetchAll(
            'SELECT id, nombre, estado, created_at, fecha_programada, hora_programada, destinatarios, enviados, entregados, fallidos
             FROM public.campaigns
             WHERE hospital_id = :hospital_id
             ORDER BY created_at DESC NULLS LAST
             LIMIT :limit',
            [
                'hospital_id' => $hospitalId,
                'limit' => $limit,
            ]
        );
    }

    public function getRecentInteractions(string $hospitalId, int $limit = 10): array
    {
        $limit = min(max(1, $limit), 50);
        return $this->db->fetchAll(
            'SELECT i.id, i.tipo, i.estado, i.created_at,
                    COALESCE(p.name, i.patient_name) AS patient_name,
                    COALESCE(p.phone, i.patient_phone) AS patient_phone,
                    COALESCE(p.email, i.patient_email) AS patient_email
             FROM public.interactions i
             LEFT JOIN public.patients p ON p.patient_id = i.patient_id
             WHERE i.hospital_id = :hospital_id
             ORDER BY i.created_at DESC
             LIMIT :limit',
            [
                'hospital_id' => $hospitalId,
                'limit' => $limit,
            ]
        );
    }

    private function computeHospitalStats(string $hospitalId): array
    {
        $row = $this->db->fetchOne(
            'WITH
             patients_count AS (
               SELECT COUNT(*)::bigint AS total_patients
               FROM public.patients
               WHERE hospital_id = :hospital_id
             ),
             campaigns_agg AS (
               SELECT
                 SUM(COALESCE(destinatarios, 0))::bigint AS total_destinatarios,
                 SUM(COALESCE(entregados, 0))::bigint AS total_entregados,
                 SUM(
                   CASE
                     WHEN lower(COALESCE(estado, \'\')) IN (\'completada\', \'completed\') THEN 0
                     WHEN (COALESCE(entregados, 0) + COALESCE(fallidos, 0)) >= COALESCE(destinatarios, 0) AND COALESCE(destinatarios, 0) > 0 THEN 0
                     ELSE 1
                   END
                 )::bigint AS active_campaigns
               FROM public.campaigns
               WHERE hospital_id = :hospital_id
             ),
             interactions_count AS (
               SELECT COUNT(*)::bigint AS total_interactions
               FROM public.interactions
               WHERE hospital_id = :hospital_id
             )
             SELECT
               COALESCE(patients_count.total_patients, 0) AS total_patients,
               COALESCE(campaigns_agg.active_campaigns, 0) AS active_campaigns,
               COALESCE(interactions_count.total_interactions, 0) AS total_interactions,
               COALESCE(campaigns_agg.total_destinatarios, 0) AS total_destinatarios,
               COALESCE(campaigns_agg.total_entregados, 0) AS total_entregados
             FROM patients_count, campaigns_agg, interactions_count',
            ['hospital_id' => $hospitalId]
        ) ?: [];

        return $this->normalizeStatsRow($row);
    }

    private function normalizeStatsRow(array $row): array
    {
        $totalDest = (int)($row['total_destinatarios'] ?? 0);
        $totalEnt = (int)($row['total_entregados'] ?? 0);
        $deliveryRate = $totalDest > 0 ? round(($totalEnt / $totalDest) * 100, 1) : 0.0;

        return [
            'total_patients' => (int)($row['total_patients'] ?? 0),
            'active_campaigns' => (int)($row['active_campaigns'] ?? 0),
            'total_interactions' => (int)($row['total_interactions'] ?? 0),
            'total_destinatarios' => $totalDest,
            'total_entregados' => $totalEnt,
            'delivery_rate' => $deliveryRate,
            'refreshed_at' => isset($row['refreshed_at']) ? (string)$row['refreshed_at'] : null,
        ];
    }

    private function isCacheFresh(mixed $refreshedAt): bool
    {
        if (!$refreshedAt) return false;
        $ts = strtotime((string)$refreshedAt);
        if (!$ts) return false;
        return (time() - $ts) <= $this->cacheTtlSeconds;
    }
}
