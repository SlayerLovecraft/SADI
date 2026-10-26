<?php

declare(strict_types=1);

namespace App\Support\Session;

final class Session
{
    private static bool $started = false;

    public static function start(array $config): void
    {
        if (self::$started) return;

        $name = (string)($config['app']['session_name'] ?? 'sadi_session');
        if ($name !== '') {
            session_name($name);
        }

        $secure = self::isHttps($config);
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        ini_set('session.use_strict_mode', '1');
        ini_set('session.cookie_httponly', '1');
        ini_set('session.cookie_samesite', 'Lax');
        ini_set('session.cookie_secure', $secure ? '1' : '0');

        session_start();
        self::$started = true;
    }

    public static function regenerate(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public static function forget(string $key): void
    {
        unset($_SESSION[$key]);
    }

    public static function flash(string $key, mixed $value): void
    {
        $_SESSION['_flash'][$key] = $value;
    }

    public static function pull(string $key, mixed $default = null): mixed
    {
        $val = $_SESSION['_flash'][$key] ?? $default;
        unset($_SESSION['_flash'][$key]);
        return $val;
    }

    public static function destroy(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return;
        }

        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'] ?? '/', $params['domain'] ?? '', (bool)($params['secure'] ?? false), (bool)($params['httponly'] ?? true));
        }

        session_destroy();
        self::$started = false;
    }

    private static function isHttps(array $config): bool
    {
        $forced = $config['app']['force_secure_cookies'] ?? null;
        if (is_bool($forced)) return $forced;

        $https = $_SERVER['HTTPS'] ?? null;
        if ($https && $https !== 'off') return true;

        $proto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? null;
        if (is_string($proto) && strtolower($proto) === 'https') return true;

        return false;
    }
}
