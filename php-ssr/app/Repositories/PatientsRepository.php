<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Infrastructure\Db;

final class PatientsRepository
{
    private Db $db;

    public function __construct(Db $db)
    {
        $this->db = $db;
    }

    public function listByHospital(string $hospitalId, array $filters, int $page, int $perPage): array
    {
        $q = trim((string)($filters['q'] ?? ''));
        $program = trim((string)($filters['program'] ?? ''));
        $city = trim((string)($filters['city'] ?? ''));

        $where = ['p.hospital_id = :hospital_id'];
        $params = ['hospital_id' => $hospitalId];

        if ($program !== '') {
            $where[] = 'p.program = :program';
            $params['program'] = $program;
        }

        if ($city !== '') {
            $where[] = 'p.city = :city';
            $params['city'] = $city;
        }

        if ($q !== '') {
            $where[] = '(p.name ILIKE :q OR p.document ILIKE :q OR p.phone ILIKE :q OR p.email ILIKE :q)';
            $params['q'] = '%' . $q . '%';
        }

        $sql =
            'SELECT p.patient_id, p.name, p.email, p.document, p.phone, p.program, p.city, p.created_at
             FROM public.patients p
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY p.created_at DESC NULLS LAST, p.patient_id DESC';

        return $this->db->paginateNoCount($sql, $params, $page, $perPage);
    }

    public function findByHospital(string $hospitalId, string $patientId): ?array
    {
        return $this->db->fetchOne(
            'SELECT patient_id, hospital_id, name, email, document, phone, birthdate, sex, city, program, address, created_at
             FROM public.patients
             WHERE hospital_id = :hospital_id AND patient_id = :patient_id
             LIMIT 1',
            [
                'hospital_id' => $hospitalId,
                'patient_id' => $patientId,
            ]
        );
    }

    public function findById(string $patientId): ?array
    {
        return $this->db->fetchOne(
            'SELECT patient_id, hospital_id, name, email, document, phone, birthdate, sex, city, program, address, created_at
             FROM public.patients
             WHERE patient_id = :patient_id
             LIMIT 1',
            [
                'patient_id' => $patientId,
            ]
        );
    }

    public function findByIdentifier(string $hospitalId, string $identifier): ?array
    {
        $identifier = trim($identifier);
        if ($identifier === '') return null;
        $isEmail = str_contains($identifier, '@');

        return $this->db->fetchOne(
            $isEmail
                ? 'SELECT patient_id, hospital_id, name, email, document, phone
                   FROM public.patients
                   WHERE hospital_id = :hospital_id AND lower(email) = lower(:identifier)
                   LIMIT 1'
                : 'SELECT patient_id, hospital_id, name, email, document, phone
                   FROM public.patients
                   WHERE hospital_id = :hospital_id AND document = :identifier
                   LIMIT 1',
            [
                'hospital_id' => $hospitalId,
                'identifier' => $isEmail ? strtolower($identifier) : $identifier,
            ]
        );
    }

    public function existsDocument(string $hospitalId, string $document, ?string $excludePatientId = null): bool
    {
        $sql =
            'SELECT 1
             FROM public.patients
             WHERE hospital_id = :hospital_id AND document = :document';

        $params = [
            'hospital_id' => $hospitalId,
            'document' => $document,
        ];

        if ($excludePatientId) {
            $sql .= ' AND patient_id <> :exclude_id';
            $params['exclude_id'] = $excludePatientId;
        }

        $sql .= ' LIMIT 1';
        return $this->db->fetchOne($sql, $params) !== null;
    }

    public function create(string $hospitalId, array $data): string
    {
        $row = $this->db->fetchOne(
            'INSERT INTO public.patients (hospital_id, name, email, document, phone, birthdate, sex, city, program, address, password_hash)
             VALUES (:hospital_id, :name, :email, :document, :phone, :birthdate, :sex, :city, :program, :address, :password_hash)
             RETURNING patient_id',
            [
                'hospital_id' => $hospitalId,
                'name' => $data['name'],
                'email' => $data['email'],
                'document' => $data['document'],
                'phone' => $data['phone'],
                'birthdate' => $data['birthdate'],
                'sex' => $data['sex'],
                'city' => $data['city'],
                'program' => $data['program'],
                'address' => $data['address'],
                'password_hash' => $data['password_hash'],
            ]
        );

        return (string)($row['patient_id'] ?? '');
    }

    public function update(string $hospitalId, string $patientId, array $data): void
    {
        $sql =
            'UPDATE public.patients
             SET name = :name,
                 email = :email,
                 document = :document,
                 phone = :phone,
                 birthdate = :birthdate,
                 sex = :sex,
                 city = :city,
                 program = :program,
                 address = :address';

        $params = [
            'hospital_id' => $hospitalId,
            'patient_id' => $patientId,
            'name' => $data['name'],
            'email' => $data['email'],
            'document' => $data['document'],
            'phone' => $data['phone'],
            'birthdate' => $data['birthdate'],
            'sex' => $data['sex'],
            'city' => $data['city'],
            'program' => $data['program'],
            'address' => $data['address'],
        ];

        if ($data['password_hash'] !== null) {
            $sql .= ', password_hash = :password_hash';
            $params['password_hash'] = $data['password_hash'];
        }

        $sql .= ' WHERE hospital_id = :hospital_id AND patient_id = :patient_id';
        $this->db->execute($sql, $params);
    }
}
