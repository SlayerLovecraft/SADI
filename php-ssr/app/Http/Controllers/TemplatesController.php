<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Infrastructure\Db;
use App\Repositories\TemplatesRepository;
use App\Support\Auth\Auth;
use App\Support\Http\Request;
use App\Support\Http\Response;
use App\Support\Security\Csrf;
use App\Support\Session\Session;
use App\View\View;

final class TemplatesController
{
    private array $categories = ['General', 'Recordatorios', 'Bienvenida', 'Seguimiento', 'Urgente'];

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
        $categoria = trim((string)($request->query['categoria'] ?? ''));

        $repo = new TemplatesRepository($db);
        $result = $repo->listByHospital($hospitalId, ['q' => $q, 'categoria' => $categoria], $page, $perPage);

        return Response::html($view->render('pages/templates', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'filters' => ['q' => $q, 'categoria' => $categoria],
            'rows' => $result['data'],
            'meta' => $result['meta'],
            'categories' => $this->categories,
            'error' => Session::pull('error', null),
        ]));
    }

    public function createForm(Request $request, Db $db, View $view, array $config): Response
    {
        $user = Auth::user();
        return Response::html($view->render('pages/templates_form', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'mode' => 'create',
            'templateId' => null,
            'error' => null,
            'values' => [
                'nombre' => '',
                'mensaje' => '',
                'categoria' => 'General',
            ],
            'categories' => $this->categories,
        ]));
    }

    public function create(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/templates');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $values = $this->extractTemplateForm($request->post);
        $error = $this->validateTemplateForm($values);
        if ($error) {
            return Response::html($view->render('pages/templates_form', [
                'user' => $user,
                'csrf' => Csrf::token(),
                'mode' => 'create',
                'templateId' => null,
                'error' => $error,
                'values' => $values,
                'categories' => $this->categories,
            ]), 422);
        }

        $repo = new TemplatesRepository($db);
        $repo->create($hospitalId, $this->normalizeTemplatePayload($values));
        return Response::redirect('/templates');
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

        $templateId = (string)($request->params['id'] ?? '');
        if ($templateId === '') return Response::redirect('/templates');

        $repo = new TemplatesRepository($db);
        $tpl = $repo->findByHospital($hospitalId, $templateId);
        if (!$tpl) return Response::redirect('/templates');

        return Response::html($view->render('pages/templates_form', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'mode' => 'edit',
            'templateId' => $templateId,
            'error' => null,
            'values' => [
                'nombre' => (string)($tpl['nombre'] ?? ''),
                'mensaje' => (string)($tpl['mensaje'] ?? ''),
                'categoria' => (string)($tpl['categoria'] ?? 'General'),
            ],
            'categories' => $this->categories,
        ]));
    }

    public function update(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/templates');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $templateId = (string)($request->params['id'] ?? '');
        if ($templateId === '') return Response::redirect('/templates');

        $values = $this->extractTemplateForm($request->post);
        $error = $this->validateTemplateForm($values);
        if ($error) {
            return Response::html($view->render('pages/templates_form', [
                'user' => $user,
                'csrf' => Csrf::token(),
                'mode' => 'edit',
                'templateId' => $templateId,
                'error' => $error,
                'values' => $values,
                'categories' => $this->categories,
            ]), 422);
        }

        $repo = new TemplatesRepository($db);
        $repo->update($hospitalId, $templateId, $this->normalizeTemplatePayload($values));
        return Response::redirect('/templates');
    }

    public function delete(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/templates');
        }

        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $templateId = (string)($request->params['id'] ?? '');
        if ($templateId === '') return Response::redirect('/templates');

        $repo = new TemplatesRepository($db);
        try {
            $repo->delete($hospitalId, $templateId);
        } catch (\Throwable $e) {
            Session::flash('error', $e->getMessage());
        }
        return Response::redirect('/templates');
    }

    private function extractTemplateForm(array $post): array
    {
        return [
            'nombre' => trim((string)($post['nombre'] ?? '')),
            'mensaje' => trim((string)($post['mensaje'] ?? '')),
            'categoria' => trim((string)($post['categoria'] ?? 'General')),
        ];
    }

    private function validateTemplateForm(array $values): ?string
    {
        if ($values['nombre'] === '') return 'El nombre es requerido.';
        if ($values['mensaje'] === '') return 'El mensaje es requerido.';
        if (mb_strlen($values['mensaje']) > 500) return 'El mensaje es demasiado largo.';
        return null;
    }

    private function normalizeTemplatePayload(array $values): array
    {
        $variables = $this->extractVariables($values['mensaje']);
        $variablesJson = json_encode($variables, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($variablesJson)) $variablesJson = '[]';

        return [
            'nombre' => $values['nombre'],
            'mensaje' => $values['mensaje'],
            'categoria' => $values['categoria'] !== '' ? $values['categoria'] : 'General',
            'variables_json' => $variablesJson,
        ];
    }

    private function extractVariables(string $message): array
    {
        $allowed = ['nombre', 'fecha_cita', 'hora_cita', 'programa', 'ciudad', 'hospital'];
        preg_match_all('/\{+\s*([a-zA-Z_]+)\s*\}+/', $message, $m);
        $found = $m[1] ?? [];
        $out = [];
        foreach ($found as $v) {
            $v = strtolower(trim((string)$v));
            if ($v === '') continue;
            if (!in_array($v, $allowed, true)) continue;
            $out[$v] = true;
        }
        return array_values(array_keys($out));
    }
}

