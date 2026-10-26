<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Infrastructure\Db;

final class TemplatesRepository
{
    private Db $db;

    public function __construct(Db $db)
    {
        $this->db = $db;
    }

    public function listByHospital(string $hospitalId, array $filters, int $page, int $perPage): array
    {
        $q = trim((string)($filters['q'] ?? ''));
        $category = trim((string)($filters['categoria'] ?? ''));

        $where = ['t.hospital_id = :hospital_id'];
        $params = ['hospital_id' => $hospitalId];

        if ($category !== '') {
            $where[] = 'lower(COALESCE(t.categoria, \'\')) = lower(:categoria)';
            $params['categoria'] = $category;
        }

        if ($q !== '') {
            $where[] = '(t.nombre ILIKE :q OR t.mensaje ILIKE :q OR COALESCE(t.categoria, \'\') ILIKE :q)';
            $params['q'] = '%' . $q . '%';
        }

        $sql =
            'SELECT t.id, t.nombre, t.mensaje, t.categoria, t.variables, t.created_at, t.updated_at
             FROM public.templates t
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY t.created_at DESC NULLS LAST, t.id DESC';

        return $this->db->paginateNoCount($sql, $params, $page, $perPage);
    }

    public function findByHospital(string $hospitalId, string $templateId): ?array
    {
        return $this->db->fetchOne(
            'SELECT id, hospital_id, nombre, mensaje, categoria, variables, created_at, updated_at
             FROM public.templates
             WHERE hospital_id = :hospital_id AND id = :id
             LIMIT 1',
            [
                'hospital_id' => $hospitalId,
                'id' => $templateId,
            ]
        );
    }

    public function create(string $hospitalId, array $data): string
    {
        $row = $this->db->fetchOne(
            'INSERT INTO public.templates (hospital_id, nombre, mensaje, categoria, variables)
             VALUES (:hospital_id, :nombre, :mensaje, :categoria, :variables::jsonb)
             RETURNING id',
            [
                'hospital_id' => $hospitalId,
                'nombre' => $data['nombre'],
                'mensaje' => $data['mensaje'],
                'categoria' => $data['categoria'],
                'variables' => $data['variables_json'],
            ]
        );

        return (string)($row['id'] ?? '');
    }

    public function update(string $hospitalId, string $templateId, array $data): void
    {
        $this->db->execute(
            'UPDATE public.templates
             SET nombre = :nombre,
                 mensaje = :mensaje,
                 categoria = :categoria,
                 variables = :variables::jsonb,
                 updated_at = now()
             WHERE hospital_id = :hospital_id AND id = :id',
            [
                'hospital_id' => $hospitalId,
                'id' => $templateId,
                'nombre' => $data['nombre'],
                'mensaje' => $data['mensaje'],
                'categoria' => $data['categoria'],
                'variables' => $data['variables_json'],
            ]
        );
    }

    public function delete(string $hospitalId, string $templateId): void
    {
        try {
            $row = $this->db->fetchOne(
                'SELECT 1 FROM public.campaigns WHERE hospital_id = :hospital_id AND template_id = :template_id LIMIT 1',
                [
                    'hospital_id' => $hospitalId,
                    'template_id' => $templateId,
                ]
            );
            if ($row) {
                throw new \RuntimeException('No se puede eliminar. Esta plantilla está siendo usada en campañas activas.');
            }
        } catch (\Throwable $e) {
        }

        $this->db->execute(
            'DELETE FROM public.templates WHERE hospital_id = :hospital_id AND id = :id',
            [
                'hospital_id' => $hospitalId,
                'id' => $templateId,
            ]
        );
    }
}
