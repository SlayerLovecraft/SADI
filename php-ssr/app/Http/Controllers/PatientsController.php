<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Infrastructure\Db;
use App\Repositories\PatientsRepository;
use App\Support\Auth\Auth;
use App\Support\Http\Request;
use App\Support\Http\Response;
use App\Support\Security\Csrf;
use App\Support\Session\Session;
use App\View\View;

final class PatientsController
{
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
        $program = trim((string)($request->query['program'] ?? ''));
        $city = trim((string)($request->query['city'] ?? ''));

        $repo = new PatientsRepository($db);
        $result = $repo->listByHospital($hospitalId, [
            'q' => $q,
            'program' => $program,
            'city' => $city,
        ], $page, $perPage);

        return Response::html($view->render('pages/patients', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'filters' => [
                'q' => $q,
                'program' => $program,
                'city' => $city,
            ],
            'rows' => $result['data'],
            'meta' => $result['meta'],
        ]));
    }

    public function createForm(Request $request, Db $db, View $view, array $config): Response
    {
        $user = Auth::user();
        return Response::html($view->render('pages/patients_form', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'mode' => 'create',
            'error' => null,
            'values' => [
                'name' => '',
                'document' => '',
                'email' => '',
                'phone' => '',
                'birthdate' => '',
                'sex' => '',
                'city' => '',
                'program' => '',
                'address' => '',
                'password' => '',
            ],
        ]));
    }

    public function create(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/patients');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $values = $this->extractPatientForm($request->post);
        $error = $this->validatePatientForm($values);

        $repo = new PatientsRepository($db);
        if (!$error && $repo->existsDocument($hospitalId, $values['document'])) {
            $error = 'Ya existe un paciente con ese documento.';
        }

        if ($error) {
            return Response::html($view->render('pages/patients_form', [
                'user' => $user,
                'csrf' => Csrf::token(),
                'mode' => 'create',
                'error' => $error,
                'values' => $values,
            ]), 422);
        }

        $payload = $this->normalizePatientPayload($values);
        $repo->create($hospitalId, $payload);
        return Response::redirect('/patients');
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

        $patientId = (string)($request->params['id'] ?? '');
        $repo = new PatientsRepository($db);
        $patient = $patientId ? $repo->findByHospital($hospitalId, $patientId) : null;
        if (!$patient) {
            return Response::redirect('/patients');
        }

        return Response::html($view->render('pages/patients_form', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'mode' => 'edit',
            'patientId' => $patientId,
            'error' => null,
            'values' => [
                'name' => (string)($patient['name'] ?? ''),
                'document' => (string)($patient['document'] ?? ''),
                'email' => (string)($patient['email'] ?? ''),
                'phone' => (string)($patient['phone'] ?? ''),
                'birthdate' => (string)($patient['birthdate'] ?? ''),
                'sex' => (string)($patient['sex'] ?? ''),
                'city' => (string)($patient['city'] ?? ''),
                'program' => (string)($patient['program'] ?? ''),
                'address' => (string)($patient['address'] ?? ''),
                'password' => '',
            ],
        ]));
    }

    public function update(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/patients');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $patientId = (string)($request->params['id'] ?? '');
        if ($patientId === '') return Response::redirect('/patients');

        $values = $this->extractPatientForm($request->post);
        $error = $this->validatePatientForm($values);

        $repo = new PatientsRepository($db);
        if (!$error && $repo->existsDocument($hospitalId, $values['document'], $patientId)) {
            $error = 'Ya existe otro paciente con ese documento.';
        }

        if ($error) {
            return Response::html($view->render('pages/patients_form', [
                'user' => $user,
                'csrf' => Csrf::token(),
                'mode' => 'edit',
                'patientId' => $patientId,
                'error' => $error,
                'values' => $values,
            ]), 422);
        }

        $payload = $this->normalizePatientPayload($values);
        $repo->update($hospitalId, $patientId, $payload);
        return Response::redirect('/patients');
    }

    private function extractPatientForm(array $post): array
    {
        return [
            'name' => trim((string)($post['name'] ?? '')),
            'document' => trim((string)($post['document'] ?? '')),
            'email' => strtolower(trim((string)($post['email'] ?? ''))),
            'phone' => trim((string)($post['phone'] ?? '')),
            'birthdate' => trim((string)($post['birthdate'] ?? '')),
            'sex' => trim((string)($post['sex'] ?? '')),
            'city' => trim((string)($post['city'] ?? '')),
            'program' => trim((string)($post['program'] ?? '')),
            'address' => trim((string)($post['address'] ?? '')),
            'password' => (string)($post['password'] ?? ''),
        ];
    }

    private function validatePatientForm(array $values): ?string
    {
        if ($values['name'] === '') return 'El nombre es requerido.';
        if ($values['document'] === '') return 'El documento es requerido.';
        if ($values['email'] !== '' && !filter_var($values['email'], FILTER_VALIDATE_EMAIL)) return 'El correo no es válido.';
        if ($values['birthdate'] !== '' && strtotime($values['birthdate']) === false) return 'La fecha de nacimiento no es válida.';
        if ($values['password'] !== '' && strlen($values['password']) < 8) return 'La contraseña debe tener al menos 8 caracteres.';
        return null;
    }

    private function normalizePatientPayload(array $values): array
    {
        $passwordHash = null;
        if ($values['password'] !== '') {
            $passwordHash = password_hash($values['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        }

        return [
            'name' => $values['name'],
            'document' => $values['document'],
            'email' => $values['email'] !== '' ? $values['email'] : null,
            'phone' => $values['phone'] !== '' ? $values['phone'] : null,
            'birthdate' => $values['birthdate'] !== '' ? $values['birthdate'] : null,
            'sex' => $values['sex'] !== '' ? $values['sex'] : null,
            'city' => $values['city'] !== '' ? $values['city'] : null,
            'program' => $values['program'] !== '' ? $values['program'] : null,
            'address' => $values['address'] !== '' ? $values['address'] : null,
            'password_hash' => $passwordHash,
        ];
    }
}
