<?php

declare(strict_types=1);

namespace App\Support\Security;

use App\Support\Session\Session;

final class Csrf
{
    public static function token(): string
    {
        $token = Session::get('_csrf', null);
        if (is_string($token) && $token !== '') {
            return $token;
        }

        $token = bin2hex(random_bytes(32));
        Session::set('_csrf', $token);
        return $token;
    }

    public static function verify(?string $token): bool
    {
        if (!$token) return false;
        $expected = Session::get('_csrf', '');
        if (!is_string($expected) || $expected === '') return false;
        return hash_equals($expected, $token);
    }
}
