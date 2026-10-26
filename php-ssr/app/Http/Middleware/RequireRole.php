<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Infrastructure\Db;
use App\Support\Auth\Auth;
use App\Support\Http\Request;
use App\Support\Http\Response;
use App\View\View;

final class RequireRole
{
    private array $roles;
    private string $redirectTo;

    public function __construct(array $roles, string $redirectTo)
    {
        $this->roles = $roles;
        $this->redirectTo = $redirectTo;
    }

    public function __invoke(Request $request, Db $db, View $view, array $config): ?Response
    {
        if (!Auth::check()) {
            return Response::redirect($this->redirectTo);
        }

        if (!Auth::hasRole($this->roles)) {
            $role = Auth::role();
            if ($role === 'doctor') return Response::redirect('/doctor/dashboard');
            if ($role === 'patient') return Response::redirect('/patient/dashboard');
            return Response::redirect('/dashboard');
        }

        return null;
    }
}
