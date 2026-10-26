<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Infrastructure\Db;

final class SegmentsRepository
{
    private Db $db;

    public function __construct(Db $db)
    {
        $this->db = $db;
    }

    public function listByHospital(string $hospitalId, array $filters, int $page, int $perPage): array
    {
        $q = trim((string)($filters['q'] ?? ''));

        $where = ['s.hospital_id = :hospital_id'];
        $params = ['hospital_id' => $hospitalId];

        if ($q !== '') {
            $where[] = '(s.nombre ILIKE :q OR COALESCE(s.ciudad, \'\') ILIKE :q OR COALESCE(s.programa, \'\') ILIKE :q)';
            $params['q'] = '%' . $q . '%';
        }

        $sql =
            'SELECT s.id, s.nombre, s.edad_min, s.edad_max, s.sexo, s.ciudad, s.programa, s.created_at, s.updated_at
             FROM public.segments s
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY s.created_at DESC NULLS LAST, s.id DESC';

        return $this->db->paginateNoCount($sql, $params, $page, $perPage);
    }

    public function findByHospital(string $hospitalId, string $segmentId): ?array
    {
        return $this->db->fetchOne(
            'SELECT id, hospital_id, nombre, edad_min, edad_max, sexo, ciudad, programa, created_at, updated_at
             FROM public.segments
             WHERE hospital_id = :hospital_id AND id = :id
             LIMIT 1',
            [
                'hospital_id' => $hospitalId,
                'id' => $segmentId,
            ]
        );
    }

    public function create(string $hospitalId, array $data): string
    {
        $row = $this->db->fetchOne(
            'INSERT INTO public.segments (hospital_id, nombre, edad_min, edad_max, sexo, ciudad, programa)
             VALUES (:hospital_id, :nombre, :edad_min, :edad_max, :sexo, :ciudad, :programa)
             RETURNING id',
            [
                'hospital_id' => $hospitalId,
                'nombre' => $data['nombre'],
                'edad_min' => $data['edad_min'],
                'edad_max' => $data['edad_max'],
                'sexo' => $data['sexo'],
                'ciudad' => $data['ciudad'],
                'programa' => $data['programa'],
            ]
        );

        return (string)($row['id'] ?? '');
    }

    public function update(string $hospitalId, string $segmentId, array $data): void
    {
        $this->db->execute(
            'UPDATE public.segments
             SET nombre = :nombre,
                 edad_min = :edad_min,
                 edad_max = :edad_max,
                 sexo = :sexo,
                 ciudad = :ciudad,
                 programa = :programa,
                 updated_at = now()
             WHERE hospital_id = :hospital_id AND id = :id',
            [
                'hospital_id' => $hospitalId,
                'id' => $segmentId,
                'nombre' => $data['nombre'],
                'edad_min' => $data['edad_min'],
                'edad_max' => $data['edad_max'],
                'sexo' => $data['sexo'],
                'ciudad' => $data['ciudad'],
                'programa' => $data['programa'],
            ]
        );
    }

    public function delete(string $hospitalId, string $segmentId): void
    {
        $this->db->execute(
            'DELETE FROM public.segments WHERE hospital_id = :hospital_id AND id = :id',
            [
                'hospital_id' => $hospitalId,
                'id' => $segmentId,
            ]
        );
    }

    public function countPatientsMatching(string $hospitalId, array $segment): int
    {
        $where = ['p.hospital_id = :hospital_id'];
        $params = ['hospital_id' => $hospitalId];

        $edadMin = $segment['edad_min'] ?? null;
        $edadMax = $segment['edad_max'] ?? null;
        if (is_numeric($edadMin)) {
            $where[] = 'p.birthdate IS NOT NULL AND date_part(\'year\', age(p.birthdate)) >= :edad_min';
            $params['edad_min'] = (int)$edadMin;
        }
        if (is_numeric($edadMax)) {
            $where[] = 'p.birthdate IS NOT NULL AND date_part(\'year\', age(p.birthdate)) <= :edad_max';
            $params['edad_max'] = (int)$edadMax;
        }

        $sexo = trim((string)($segment['sexo'] ?? ''));
        if ($sexo !== '' && strtolower($sexo) !== 'todos') {
            $where[] = 'lower(COALESCE(p.sex, \'\')) = lower(:sexo)';
            $params['sexo'] = $sexo;
        }

        $ciudad = trim((string)($segment['ciudad'] ?? ''));
        if ($ciudad !== '') {
            $where[] = 'lower(COALESCE(p.city, \'\')) = lower(:ciudad)';
            $params['ciudad'] = $ciudad;
        }

        $programa = trim((string)($segment['programa'] ?? ''));
        if ($programa !== '') {
            $where[] = 'lower(COALESCE(p.program, \'\')) = lower(:programa)';
            $params['programa'] = $programa;
        }

        try {
            $row = $this->db->fetchOne(
                'SELECT COUNT(*)::bigint AS n
                 FROM public.patients p
                 WHERE ' . implode(' AND ', $where),
                $params
            );
            return (int)($row['n'] ?? 0);
        } catch (\Throwable $e) {
            return 0;
        }
    }
}

