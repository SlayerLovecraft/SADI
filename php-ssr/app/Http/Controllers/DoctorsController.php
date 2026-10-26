<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Infrastructure\Db;
use App\Repositories\StaffRepository;
use App\Support\Auth\Auth;
use App\Support\Http\Request;
use App\Support\Http\Response;
use App\Support\Security\Csrf;
use App\Support\Session\Session;
use App\View\View;

final class DoctorsController
{
    private array $specialtyOptions = [
        'cardiologo' => 'Cardiólogo',
        'obstetra' => 'Obstetra',
        'general' => 'General',
        'radiologo' => 'Radiólogo',
        'neurologico' => 'Neurólogo',
        'pediatra' => 'Pediatra',
        'traumatologo' => 'Traumatólogo',
        'ginecologo' => 'Ginecólogo',
        'oncologo' => 'Oncólogo',
        'dermatologo' => 'Dermatólogo',
    ];

    public function index(Request $request, Db $db, View $view, array $config): Response
    {
        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $page = max(1, (int)($request->query['page'] ?? 1));
        $perPage = min(max(10, (int)($request->query['per_page'] ?? 25)), 100);
        $q = trim((string)($request->query['q'] ?? ''));

        $repo = new StaffRepository($db);
        $result = $repo->listByHospital($hospitalId, ['q' => $q], $page, $perPage);

        return Response::html($view->render('pages/doctors', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'filters' => ['q' => $q],
            'rows' => $result['data'],
            'meta' => $result['meta'],
            'specialtyOptions' => $this->specialtyOptions,
        ]));
    }

    public function createForm(Request $request, Db $db, View $view, array $config): Response
    {
        $user = Auth::user();
        return Response::html($view->render('pages/doctors_form', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'mode' => 'create',
            'doctorId' => null,
            'error' => null,
            'values' => [
                'doctor_name' => '',
                'doctor_email' => '',
                'doctor_password' => '',
                'doctor_specialty' => 'general',
                'is_active' => true,
            ],
            'specialtyOptions' => $this->specialtyOptions,
        ]));
    }

    public function create(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/doctors');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $values = $this->extractDoctorForm($request->post);
        $error = $this->validateDoctorForm($values, true);
        $repo = new StaffRepository($db);
        if (!$error && $repo->existsEmail($hospitalId, $values['doctor_email'])) {
            $error = 'Ya existe un doctor con ese correo en este hospital.';
        }

        if ($error) {
            return Response::html($view->render('pages/doctors_form', [
                'user' => $user,
                'csrf' => Csrf::token(),
                'mode' => 'create',
                'doctorId' => null,
                'error' => $error,
                'values' => $values,
                'specialtyOptions' => $this->specialtyOptions,
            ]), 422);
        }

        $payload = $this->normalizeDoctorPayload($values, true);
        $repo->create($hospitalId, $payload);
        return Response::redirect('/doctors');
    }

    public function editForm(Request $request, Db $db, View $view, array $config): Response
    {
        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $doctorId = (string)($request->params['id'] ?? '');
        if ($doctorId === '') return Response::redirect('/doctors');

        $repo = new StaffRepository($db);
        $doctor = $repo->findByHospital($hospitalId, $doctorId);
        if (!$doctor) return Response::redirect('/doctors');

        return Response::html($view->render('pages/doctors_form', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'mode' => 'edit',
            'doctorId' => $doctorId,
            'error' => null,
            'values' => [
                'doctor_name' => (string)($doctor['doctor_name'] ?? ''),
                'doctor_email' => (string)($doctor['doctor_email'] ?? ''),
                'doctor_password' => '',
                'doctor_specialty' => (string)($doctor['doctor_specialty'] ?? 'general'),
                'is_active' => (bool)($doctor['is_active'] ?? true),
            ],
            'specialtyOptions' => $this->specialtyOptions,
        ]));
    }

    public function update(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/doctors');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $doctorId = (string)($request->params['id'] ?? '');
        if ($doctorId === '') return Response::redirect('/doctors');

        $values = $this->extractDoctorForm($request->post);
        $error = $this->validateDoctorForm($values, false);
        $repo = new StaffRepository($db);
        if (!$error && $repo->existsEmail($hospitalId, $values['doctor_email'], $doctorId)) {
            $error = 'Ya existe otro doctor con ese correo en este hospital.';
        }

        if ($error) {
            return Response::html($view->render('pages/doctors_form', [
                'user' => $user,
                'csrf' => Csrf::token(),
                'mode' => 'edit',
                'doctorId' => $doctorId,
                'error' => $error,
                'values' => $values,
                'specialtyOptions' => $this->specialtyOptions,
            ]), 422);
        }

        $payload = $this->normalizeDoctorPayload($values, false);
        $repo->update($hospitalId, $doctorId, $payload);
        return Response::redirect('/doctors');
    }

    public function delete(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/doctors');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $doctorId = (string)($request->params['id'] ?? '');
        if ($doctorId === '') return Response::redirect('/doctors');

        $repo = new StaffRepository($db);
        $repo->delete($hospitalId, $doctorId);
        return Response::redirect('/doctors');
    }

    private function extractDoctorForm(array $post): array
    {
        $isActiveRaw = $post['is_active'] ?? null;
        $isActive = true;
        if (is_string($isActiveRaw)) {
            $isActive = in_array(strtolower(trim($isActiveRaw)), ['1', 'true', 'on', 'yes'], true);
        } elseif (is_int($isActiveRaw)) {
            $isActive = $isActiveRaw === 1;
        } elseif (is_bool($isActiveRaw)) {
            $isActive = $isActiveRaw;
        }

        return [
            'doctor_name' => trim((string)($post['doctor_name'] ?? '')),
            'doctor_email' => strtolower(trim((string)($post['doctor_email'] ?? ''))),
            'doctor_password' => (string)($post['doctor_password'] ?? ''),
            'doctor_specialty' => trim((string)($post['doctor_specialty'] ?? 'general')),
            'is_active' => $isActive,
        ];
    }

    private function validateDoctorForm(array $values, bool $isCreate): ?string
    {
        if ($values['doctor_email'] === '') return 'El correo es requerido.';
        if (!filter_var($values['doctor_email'], FILTER_VALIDATE_EMAIL)) return 'El correo no es válido.';
        if ($isCreate && trim($values['doctor_password']) === '') return 'La contraseña es requerida.';
        if (trim($values['doctor_password']) !== '' && strlen(trim($values['doctor_password'])) < 8) {
            return 'La contraseña debe tener al menos 8 caracteres.';
        }
        if ($values['doctor_specialty'] === '') return 'La especialidad es requerida.';
        return null;
    }

    private function normalizeDoctorPayload(array $values, bool $isCreate): array
    {
        $passwordHash = '';
        if (trim($values['doctor_password']) !== '') {
            $passwordHash = password_hash(trim($values['doctor_password']), PASSWORD_BCRYPT, ['cost' => 12]);
        } elseif ($isCreate) {
            $passwordHash = password_hash(bin2hex(random_bytes(8)), PASSWORD_BCRYPT, ['cost' => 12]);
        }

        $payload = [
            'doctor_name' => $values['doctor_name'] !== '' ? $values['doctor_name'] : null,
            'doctor_email' => $values['doctor_email'],
            'doctor_specialty' => $values['doctor_specialty'],
            'is_active' => (bool)$values['is_active'],
        ];

        if ($isCreate || $passwordHash !== '') {
            $payload['doctor_password'] = $passwordHash;
        }

        return $payload;
    }
}

