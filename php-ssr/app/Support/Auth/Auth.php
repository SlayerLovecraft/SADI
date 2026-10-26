<?php

declare(strict_types=1);

namespace App\Support\Auth;

use App\Support\Session\Session;

final class Auth
{
    public static function user(): ?array
    {
        $u = Session::get('auth', null);
        return is_array($u) ? $u : null;
    }

    public static function check(): bool
    {
        return self::user() !== null;
    }

    public static function role(): ?string
    {
        $u = self::user();
        $role = $u['role'] ?? null;
        return is_string($role) ? $role : null;
    }

    public static function login(array $user): void
    {
        Session::regenerate();
        Session::set('auth', $user);
    }

    public static function logout(): void
    {
        Session::forget('auth');
        Session::regenerate();
    }

    public static function hasRole(array $roles): bool
    {
        $role = self::role();
        if (!$role) return false;
        return in_array($role, $roles, true);
    }
}
