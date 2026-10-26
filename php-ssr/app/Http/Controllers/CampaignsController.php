<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Infrastructure\Db;
use App\Repositories\CampaignsRepository;
use App\Support\Auth\Auth;
use App\Support\Http\Request;
use App\Support\Http\Response;
use App\Support\Security\Csrf;
use App\Support\Session\Session;
use App\View\View;

final class CampaignsController
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
        $q = trim((string)($request->query['q'] ?? ''));

        $repo = new CampaignsRepository($db);
        $result = $repo->listByHospital($hospitalId, [
            'status' => $status,
            'q' => $q,
        ], $page, $perPage);

        return Response::html($view->render('pages/campaigns', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'filters' => [
                'status' => $status,
                'q' => $q,
            ],
            'rows' => $result['data'],
            'meta' => $result['meta'],
        ]));
    }

    public function createForm(Request $request, Db $db, View $view, array $config): Response
    {
        $user = Auth::user();
        return Response::html($view->render('pages/campaigns_form', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'mode' => 'create',
            'error' => null,
            'values' => [
                'nombre' => '',
                'estado' => 'Programada',
                'fecha_programada' => '',
                'hora_programada' => '',
            ],
        ]));
    }

    public function create(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/campaigns');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $values = $this->extractForm($request->post);
        $error = $this->validateForm($values);

        if ($error) {
            return Response::html($view->render('pages/campaigns_form', [
                'user' => $user,
                'csrf' => Csrf::token(),
                'mode' => 'create',
                'error' => $error,
                'values' => $values,
            ]), 422);
        }

        $repo = new CampaignsRepository($db);
        $repo->create($hospitalId, $this->normalizePayload($values));
        return Response::redirect('/campaigns');
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
        if ($id === '') return Response::redirect('/campaigns');

        $repo = new CampaignsRepository($db);
        $c = $repo->findByHospital($hospitalId, $id);
        if (!$c) return Response::redirect('/campaigns');

        return Response::html($view->render('pages/campaigns_form', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'mode' => 'edit',
            'campaignId' => $id,
            'error' => null,
            'values' => [
                'nombre' => (string)($c['nombre'] ?? ''),
                'estado' => (string)($c['estado'] ?? ''),
                'fecha_programada' => (string)($c['fecha_programada'] ?? ''),
                'hora_programada' => (string)($c['hora_programada'] ?? ''),
            ],
        ]));
    }

    public function update(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/campaigns');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $id = (string)($request->params['id'] ?? '');
        if ($id === '') return Response::redirect('/campaigns');

        $values = $this->extractForm($request->post);
        $error = $this->validateForm($values);

        if ($error) {
            return Response::html($view->render('pages/campaigns_form', [
                'user' => $user,
                'csrf' => Csrf::token(),
                'mode' => 'edit',
                'campaignId' => $id,
                'error' => $error,
                'values' => $values,
            ]), 422);
        }

        $repo = new CampaignsRepository($db);
        $repo->update($hospitalId, $id, $this->normalizePayload($values));
        return Response::redirect('/campaigns');
    }

    private function extractForm(array $post): array
    {
        return [
            'nombre' => trim((string)($post['nombre'] ?? '')),
            'estado' => trim((string)($post['estado'] ?? 'Programada')),
            'fecha_programada' => trim((string)($post['fecha_programada'] ?? '')),
            'hora_programada' => trim((string)($post['hora_programada'] ?? '')),
        ];
    }

    private function validateForm(array $values): ?string
    {
        if ($values['nombre'] === '') return 'El nombre es requerido.';
        if ($values['fecha_programada'] !== '' && strtotime($values['fecha_programada']) === false) return 'La fecha programada no es válida.';
        if ($values['hora_programada'] !== '' && !preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $values['hora_programada'])) return 'La hora programada no es válida.';
        return null;
    }

    private function normalizePayload(array $values): array
    {
        return [
            'nombre' => $values['nombre'],
            'estado' => $values['estado'] !== '' ? $values['estado'] : null,
            'fecha_programada' => $values['fecha_programada'] !== '' ? $values['fecha_programada'] : null,
            'hora_programada' => $values['hora_programada'] !== '' ? $values['hora_programada'] : null,
        ];
    }
}
