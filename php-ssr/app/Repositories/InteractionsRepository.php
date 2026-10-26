<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Infrastructure\Db;

final class InteractionsRepository
{
    private Db $db;

    public function __construct(Db $db)
    {
        $this->db = $db;
    }

    public function listByHospital(string $hospitalId, array $filters, int $page, int $perPage): array
    {
        $status = trim((string)($filters['status'] ?? ''));
        $tipo = trim((string)($filters['tipo'] ?? ''));
        $q = trim((string)($filters['q'] ?? ''));

        $where = ['i.hospital_id = :hospital_id'];
        $params = ['hospital_id' => $hospitalId];

        if ($status !== '') {
            $where[] = 'lower(COALESCE(i.estado, \'\')) = lower(:status)';
            $params['status'] = $status;
        }

        if ($tipo !== '') {
            $where[] = 'lower(COALESCE(i.tipo, \'\')) = lower(:tipo)';
            $params['tipo'] = $tipo;
        }

        if ($q !== '') {
            $where[] = '(COALESCE(p.name, i.patient_name) ILIKE :q OR COALESCE(p.phone, i.patient_phone) ILIKE :q OR COALESCE(p.email, i.patient_email) ILIKE :q OR COALESCE(i.asunto, \'\') ILIKE :q OR COALESCE(i.mensaje, \'\') ILIKE :q)';
            $params['q'] = '%' . $q . '%';
        }

        $sql =
            'SELECT i.id, i.tipo, i.estado, i.prioridad, i.asunto, i.created_at,
                    COALESCE(p.patient_id, i.patient_id) AS patient_id,
                    COALESCE(p.name, i.patient_name) AS patient_name,
                    COALESCE(p.phone, i.patient_phone) AS patient_phone,
                    COALESCE(p.email, i.patient_email) AS patient_email
             FROM public.interactions i
             LEFT JOIN public.patients p ON p.patient_id = i.patient_id
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY i.created_at DESC NULLS LAST, i.id DESC';

        return $this->db->paginateNoCount($sql, $params, $page, $perPage);
    }

    public function findByHospital(string $hospitalId, string $interactionId): ?array
    {
        return $this->db->fetchOne(
            'SELECT id, hospital_id, patient_id, patient_name, patient_phone, patient_email,
                    tipo, asunto, mensaje, prioridad, estado, created_at
             FROM public.interactions
             WHERE hospital_id = :hospital_id AND id = :id
             LIMIT 1',
            [
                'hospital_id' => $hospitalId,
                'id' => $interactionId,
            ]
        );
    }

    public function create(string $hospitalId, array $data): string
    {
        $row = $this->db->fetchOne(
            'INSERT INTO public.interactions (hospital_id, patient_id, patient_name, patient_phone, patient_email, tipo, asunto, mensaje, prioridad, estado)
             VALUES (:hospital_id, :patient_id, :patient_name, :patient_phone, :patient_email, :tipo, :asunto, :mensaje, :prioridad, :estado)
             RETURNING id',
            [
                'hospital_id' => $hospitalId,
                'patient_id' => $data['patient_id'],
                'patient_name' => $data['patient_name'],
                'patient_phone' => $data['patient_phone'],
                'patient_email' => $data['patient_email'],
                'tipo' => $data['tipo'],
                'asunto' => $data['asunto'],
                'mensaje' => $data['mensaje'],
                'prioridad' => $data['prioridad'],
                'estado' => $data['estado'],
            ]
        );

        return (string)($row['id'] ?? '');
    }

    public function update(string $hospitalId, string $interactionId, array $data): void
    {
        $this->db->execute(
            'UPDATE public.interactions
             SET tipo = :tipo,
                 asunto = :asunto,
                 mensaje = :mensaje,
                 prioridad = :prioridad,
                 estado = :estado
             WHERE hospital_id = :hospital_id AND id = :id',
            [
                'hospital_id' => $hospitalId,
                'id' => $interactionId,
                'tipo' => $data['tipo'],
                'asunto' => $data['asunto'],
                'mensaje' => $data['mensaje'],
                'prioridad' => $data['prioridad'],
                'estado' => $data['estado'],
            ]
        );
    }
}
