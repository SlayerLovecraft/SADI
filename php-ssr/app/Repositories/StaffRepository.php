<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Infrastructure\Db;

final class StaffRepository
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
            $where[] = '(s.doctor_name ILIKE :q OR s.doctor_email ILIKE :q OR s.doctor_specialty ILIKE :q)';
            $params['q'] = '%' . $q . '%';
        }

        $sql =
            'SELECT s.doctor_id, s.doctor_name, s.doctor_email, s.doctor_specialty, s.is_active, s.hospital_id
             FROM public.staff s
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY lower(COALESCE(s.doctor_name, \'\')) ASC NULLS LAST, lower(COALESCE(s.doctor_email, \'\')) ASC NULLS LAST, s.doctor_id DESC';

        return $this->db->paginateNoCount($sql, $params, $page, $perPage);
    }

    public function findByHospital(string $hospitalId, string $doctorId): ?array
    {
        return $this->db->fetchOne(
            'SELECT doctor_id, doctor_name, doctor_email, doctor_specialty, is_active, hospital_id
             FROM public.staff
             WHERE hospital_id = :hospital_id AND doctor_id = :doctor_id
             LIMIT 1',
            [
                'hospital_id' => $hospitalId,
                'doctor_id' => $doctorId,
            ]
        );
    }

    public function existsEmail(string $hospitalId, string $email, ?string $excludeDoctorId = null): bool
    {
        $sql = 'SELECT 1 FROM public.staff WHERE hospital_id = :hospital_id AND lower(doctor_email) = lower(:email)';
        $params = [
            'hospital_id' => $hospitalId,
            'email' => $email,
        ];

        if (is_string($excludeDoctorId) && $excludeDoctorId !== '') {
            $sql .= ' AND doctor_id <> :exclude_id';
            $params['exclude_id'] = $excludeDoctorId;
        }

        $sql .= ' LIMIT 1';

        $row = $this->db->fetchOne($sql, $params);
        return (bool)$row;
    }

    public function create(string $hospitalId, array $data): string
    {
        $row = $this->db->fetchOne(
            'INSERT INTO public.staff (doctor_name, doctor_email, doctor_password, doctor_specialty, hospital_id, is_active)
             VALUES (:doctor_name, :doctor_email, :doctor_password, :doctor_specialty, :hospital_id, :is_active)
             RETURNING doctor_id',
            [
                'doctor_name' => $data['doctor_name'],
                'doctor_email' => $data['doctor_email'],
                'doctor_password' => $data['doctor_password'],
                'doctor_specialty' => $data['doctor_specialty'],
                'hospital_id' => $hospitalId,
                'is_active' => (bool)$data['is_active'],
            ]
        );

        return (string)($row['doctor_id'] ?? '');
    }

    public function update(string $hospitalId, string $doctorId, array $data): void
    {
        $set = [
            'doctor_name = :doctor_name',
            'doctor_email = :doctor_email',
            'doctor_specialty = :doctor_specialty',
            'is_active = :is_active',
        ];
        $params = [
            'hospital_id' => $hospitalId,
            'doctor_id' => $doctorId,
            'doctor_name' => $data['doctor_name'],
            'doctor_email' => $data['doctor_email'],
            'doctor_specialty' => $data['doctor_specialty'],
            'is_active' => (bool)$data['is_active'],
        ];

        if (isset($data['doctor_password']) && is_string($data['doctor_password']) && $data['doctor_password'] !== '') {
            $set[] = 'doctor_password = :doctor_password';
            $params['doctor_password'] = $data['doctor_password'];
        }

        $this->db->execute(
            'UPDATE public.staff
             SET ' . implode(', ', $set) . '
             WHERE hospital_id = :hospital_id AND doctor_id = :doctor_id',
            $params
        );
    }

    public function delete(string $hospitalId, string $doctorId): void
    {
        $this->db->execute(
            'DELETE FROM public.staff WHERE hospital_id = :hospital_id AND doctor_id = :doctor_id',
            [
                'hospital_id' => $hospitalId,
                'doctor_id' => $doctorId,
            ]
        );
    }
}

