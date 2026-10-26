<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Infrastructure\Db;
use App\Repositories\SegmentsRepository;
use App\Support\Auth\Auth;
use App\Support\Http\Request;
use App\Support\Http\Response;
use App\Support\Security\Csrf;
use App\Support\Session\Session;
use App\View\View;

final class SegmentationController
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

        $repo = new SegmentsRepository($db);
        $result = $repo->listByHospital($hospitalId, ['q' => $q], $page, $perPage);

        $rows = is_array($result['data'] ?? null) ? $result['data'] : [];
        foreach ($rows as $i => $seg) {
            if (!is_array($seg)) continue;
            $rows[$i]['size'] = $repo->countPatientsMatching($hospitalId, $seg);
        }

        return Response::html($view->render('pages/segmentation', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'filters' => ['q' => $q],
            'rows' => $rows,
            'meta' => $result['meta'],
        ]));
    }

    public function createForm(Request $request, Db $db, View $view, array $config): Response
    {
        $user = Auth::user();
        return Response::html($view->render('pages/segmentation_form', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'mode' => 'create',
            'segmentId' => null,
            'error' => null,
            'values' => [
                'nombre' => '',
                'edad_min' => '',
                'edad_max' => '',
                'sexo' => 'Todos',
                'ciudad' => '',
                'programa' => '',
            ],
        ]));
    }

    public function create(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/segmentation');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $values = $this->extractSegmentForm($request->post);
        $error = $this->validateSegmentForm($values);
        if ($error) {
            return Response::html($view->render('pages/segmentation_form', [
                'user' => $user,
                'csrf' => Csrf::token(),
                'mode' => 'create',
                'segmentId' => null,
                'error' => $error,
                'values' => $values,
            ]), 422);
        }

        $repo = new SegmentsRepository($db);
        $repo->create($hospitalId, $this->normalizeSegmentPayload($values));
        return Response::redirect('/segmentation');
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

        $segmentId = (string)($request->params['id'] ?? '');
        if ($segmentId === '') return Response::redirect('/segmentation');

        $repo = new SegmentsRepository($db);
        $segment = $repo->findByHospital($hospitalId, $segmentId);
        if (!$segment) return Response::redirect('/segmentation');

        return Response::html($view->render('pages/segmentation_form', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'mode' => 'edit',
            'segmentId' => $segmentId,
            'error' => null,
            'values' => [
                'nombre' => (string)($segment['nombre'] ?? ''),
                'edad_min' => isset($segment['edad_min']) ? (string)$segment['edad_min'] : '',
                'edad_max' => isset($segment['edad_max']) ? (string)$segment['edad_max'] : '',
                'sexo' => (string)($segment['sexo'] ?? 'Todos'),
                'ciudad' => (string)($segment['ciudad'] ?? ''),
                'programa' => (string)($segment['programa'] ?? ''),
            ],
        ]));
    }

    public function update(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/segmentation');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $segmentId = (string)($request->params['id'] ?? '');
        if ($segmentId === '') return Response::redirect('/segmentation');

        $values = $this->extractSegmentForm($request->post);
        $error = $this->validateSegmentForm($values);
        if ($error) {
            return Response::html($view->render('pages/segmentation_form', [
                'user' => $user,
                'csrf' => Csrf::token(),
                'mode' => 'edit',
                'segmentId' => $segmentId,
                'error' => $error,
                'values' => $values,
            ]), 422);
        }

        $repo = new SegmentsRepository($db);
        $repo->update($hospitalId, $segmentId, $this->normalizeSegmentPayload($values));
        return Response::redirect('/segmentation');
    }

    public function delete(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/segmentation');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $segmentId = (string)($request->params['id'] ?? '');
        if ($segmentId === '') return Response::redirect('/segmentation');

        $repo = new SegmentsRepository($db);
        $repo->delete($hospitalId, $segmentId);
        return Response::redirect('/segmentation');
    }

    private function extractSegmentForm(array $post): array
    {
        return [
            'nombre' => trim((string)($post['nombre'] ?? '')),
            'edad_min' => trim((string)($post['edad_min'] ?? '')),
            'edad_max' => trim((string)($post['edad_max'] ?? '')),
            'sexo' => trim((string)($post['sexo'] ?? 'Todos')),
            'ciudad' => trim((string)($post['ciudad'] ?? '')),
            'programa' => trim((string)($post['programa'] ?? '')),
        ];
    }

    private function validateSegmentForm(array $values): ?string
    {
        if ($values['nombre'] === '') return 'El nombre es requerido.';
        if ($values['edad_min'] !== '' && !ctype_digit($values['edad_min'])) return 'Edad mínima inválida.';
        if ($values['edad_max'] !== '' && !ctype_digit($values['edad_max'])) return 'Edad máxima inválida.';
        if ($values['edad_min'] !== '' && $values['edad_max'] !== '' && (int)$values['edad_min'] > (int)$values['edad_max']) {
            return 'Edad mínima no puede ser mayor que edad máxima.';
        }
        return null;
    }

    private function normalizeSegmentPayload(array $values): array
    {
        return [
            'nombre' => $values['nombre'],
            'edad_min' => $values['edad_min'] !== '' ? (int)$values['edad_min'] : null,
            'edad_max' => $values['edad_max'] !== '' ? (int)$values['edad_max'] : null,
            'sexo' => $values['sexo'] !== '' ? $values['sexo'] : 'Todos',
            'ciudad' => $values['ciudad'] !== '' ? $values['ciudad'] : null,
            'programa' => $values['programa'] !== '' ? $values['programa'] : null,
        ];
    }
}

