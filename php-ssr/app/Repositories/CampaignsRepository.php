<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Infrastructure\Db;

final class CampaignsRepository
{
    private Db $db;

    public function __construct(Db $db)
    {
        $this->db = $db;
    }

    public function listByHospital(string $hospitalId, array $filters, int $page, int $perPage): array
    {
        $status = trim((string)($filters['status'] ?? ''));
        $q = trim((string)($filters['q'] ?? ''));

        $where = ['c.hospital_id = :hospital_id'];
        $params = ['hospital_id' => $hospitalId];

        if ($status !== '') {
            $where[] = 'lower(COALESCE(c.estado, \'\')) = lower(:status)';
            $params['status'] = $status;
        }

        if ($q !== '') {
            $where[] = '(c.nombre ILIKE :q)';
            $params['q'] = '%' . $q . '%';
        }

        $sql =
            'SELECT c.id, c.nombre, c.estado, c.created_at, c.fecha_programada, c.hora_programada, c.fecha_envio,
                    c.destinatarios, c.enviados, c.entregados, c.fallidos
             FROM public.campaigns c
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY c.created_at DESC NULLS LAST, c.id DESC';

        return $this->db->paginateNoCount($sql, $params, $page, $perPage);
    }

    public function findByHospital(string $hospitalId, string $campaignId): ?array
    {
        return $this->db->fetchOne(
            'SELECT id, hospital_id, nombre, estado, created_at, fecha_programada, hora_programada, fecha_envio
             FROM public.campaigns
             WHERE hospital_id = :hospital_id AND id = :id
             LIMIT 1',
            [
                'hospital_id' => $hospitalId,
                'id' => $campaignId,
            ]
        );
    }

    public function create(string $hospitalId, array $data): string
    {
        $row = $this->db->fetchOne(
            'INSERT INTO public.campaigns (hospital_id, nombre, estado, fecha_programada, hora_programada)
             VALUES (:hospital_id, :nombre, :estado, :fecha_programada, :hora_programada)
             RETURNING id',
            [
                'hospital_id' => $hospitalId,
                'nombre' => $data['nombre'],
                'estado' => $data['estado'],
                'fecha_programada' => $data['fecha_programada'],
                'hora_programada' => $data['hora_programada'],
            ]
        );

        return (string)($row['id'] ?? '');
    }

    public function update(string $hospitalId, string $campaignId, array $data): void
    {
        $this->db->execute(
            'UPDATE public.campaigns
             SET nombre = :nombre,
                 estado = :estado,
                 fecha_programada = :fecha_programada,
                 hora_programada = :hora_programada
             WHERE hospital_id = :hospital_id AND id = :id',
            [
                'hospital_id' => $hospitalId,
                'id' => $campaignId,
                'nombre' => $data['nombre'],
                'estado' => $data['estado'],
                'fecha_programada' => $data['fecha_programada'],
                'hora_programada' => $data['hora_programada'],
            ]
        );
    }
}
