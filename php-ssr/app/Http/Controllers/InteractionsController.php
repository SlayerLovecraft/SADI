<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Infrastructure\Db;
use App\Repositories\InteractionsRepository;
use App\Repositories\PatientsRepository;
use App\Support\Auth\Auth;
use App\Support\Http\Request;
use App\Support\Http\Response;
use App\Support\Security\Csrf;
use App\Support\Session\Session;
use App\View\View;

final class InteractionsController
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
        $status = trim((string)($request->query['status'] ?? ''));
        $tipo = trim((string)($request->query['tipo'] ?? ''));
        $q = trim((string)($request->query['q'] ?? ''));

        $repo = new InteractionsRepository($db);
        $result = $repo->listByHospital($hospitalId, [
            'status' => $status,
            'tipo' => $tipo,
            'q' => $q,
        ], $page, $perPage);

        return Response::html($view->render('pages/interactions', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'filters' => [
                'status' => $status,
                'tipo' => $tipo,
                'q' => $q,
            ],
            'rows' => $result['data'],
            'meta' => $result['meta'],
        ]));
    }

    public function createForm(Request $request, Db $db, View $view, array $config): Response
    {
        $user = Auth::user();
        return Response::html($view->render('pages/interactions_form', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'mode' => 'create',
            'error' => null,
            'values' => [
                'patient_identifier' => '',
                'tipo' => 'pqr',
                'asunto' => '',
                'mensaje' => '',
                'prioridad' => '2',
                'estado' => 'pendiente',
            ],
        ]));
    }

    public function create(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/interactions');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $values = $this->extractForm($request->post);
        $error = $this->validateForm($values, true);

        $patientsRepo = new PatientsRepository($db);
        $patient = null;
        if (!$error) {
            $patient = $patientsRepo->findByIdentifier($hospitalId, $values['patient_identifier']);
            if (!$patient) $error = 'Paciente no encontrado para ese documento/correo.';
        }

        if ($error) {
            return Response::html($view->render('pages/interactions_form', [
                'user' => $user,
                'csrf' => Csrf::token(),
                'mode' => 'create',
                'error' => $error,
                'values' => $values,
            ]), 422);
        }

        $repo = new InteractionsRepository($db);
        $repo->create($hospitalId, [
            'patient_id' => $patient['patient_id'],
            'patient_name' => $patient['name'] ?? null,
            'patient_phone' => $patient['phone'] ?? null,
            'patient_email' => $patient['email'] ?? null,
            'tipo' => $values['tipo'],
            'asunto' => $values['asunto'],
            'mensaje' => $values['mensaje'],
            'prioridad' => (int)$values['prioridad'],
            'estado' => $values['estado'],
        ]);

        return Response::redirect('/interactions');
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

        $id = (string)($request->params['id'] ?? '');
        if ($id === '') return Response::redirect('/interactions');

        $repo = new InteractionsRepository($db);
        $i = $repo->findByHospital($hospitalId, $id);
        if (!$i) return Response::redirect('/interactions');

        return Response::html($view->render('pages/interactions_form', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'mode' => 'edit',
            'interactionId' => $id,
            'error' => null,
            'values' => [
                'patient_identifier' => '',
                'tipo' => (string)($i['tipo'] ?? ''),
                'asunto' => (string)($i['asunto'] ?? ''),
                'mensaje' => (string)($i['mensaje'] ?? ''),
                'prioridad' => (string)($i['prioridad'] ?? '2'),
                'estado' => (string)($i['estado'] ?? 'pendiente'),
                'patient_name' => (string)($i['patient_name'] ?? ''),
                'patient_email' => (string)($i['patient_email'] ?? ''),
            ],
        ]));
    }

    public function update(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/interactions');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $id = (string)($request->params['id'] ?? '');
        if ($id === '') return Response::redirect('/interactions');

        $values = $this->extractForm($request->post);
        $error = $this->validateForm($values, false);

        if ($error) {
            return Response::html($view->render('pages/interactions_form', [
                'user' => $user,
                'csrf' => Csrf::token(),
                'mode' => 'edit',
                'interactionId' => $id,
                'error' => $error,
                'values' => $values,
            ]), 422);
        }

        $repo = new InteractionsRepository($db);
        $repo->update($hospitalId, $id, [
            'tipo' => $values['tipo'],
            'asunto' => $values['asunto'],
            'mensaje' => $values['mensaje'],
            'prioridad' => (int)$values['prioridad'],
            'estado' => $values['estado'],
        ]);

        return Response::redirect('/interactions');
    }

    private function extractForm(array $post): array
    {
        return [
            'patient_identifier' => trim((string)($post['patient_identifier'] ?? '')),
            'tipo' => trim((string)($post['tipo'] ?? '')),
            'asunto' => trim((string)($post['asunto'] ?? '')),
            'mensaje' => trim((string)($post['mensaje'] ?? '')),
            'prioridad' => trim((string)($post['prioridad'] ?? '2')),
            'estado' => trim((string)($post['estado'] ?? 'pendiente')),
            'patient_name' => trim((string)($post['patient_name'] ?? '')),
            'patient_email' => trim((string)($post['patient_email'] ?? '')),
        ];
    }

    private function validateForm(array $values, bool $requirePatientIdentifier): ?string
    {
        if ($requirePatientIdentifier && $values['patient_identifier'] === '') return 'Documento o correo del paciente es requerido.';
        if ($values['tipo'] === '') return 'El tipo es requerido.';
        if ($values['asunto'] === '') return 'El asunto es requerido.';
        if ($values['mensaje'] === '') return 'El mensaje es requerido.';
        $p = (int)$values['prioridad'];
        if ($p < 1 || $p > 3) return 'La prioridad debe ser 1, 2 o 3.';
        if ($values['estado'] === '') return 'El estado es requerido.';
        return null;
    }
}
