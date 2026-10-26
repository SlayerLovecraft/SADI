<?php

declare(strict_types=1);

use App\Infrastructure\Db;
use App\Support\Env;
use App\Support\Http\Request;
use App\Support\Http\Response;
use App\Support\Routing\Router;
use App\Support\Session\Session;
use App\View\View;

final class StaticFile
{
    public static function maybeServeFromPublicDir(string $publicDir): void
    {
        $uri = (string)($_SERVER['REQUEST_URI'] ?? '/');
        $path = (string)(parse_url($uri, PHP_URL_PATH) ?? '/');
        if ($path === '' || $path === '/') return;

        if (!str_starts_with($path, '/assets/')) return;

        $publicReal = realpath($publicDir);
        if ($publicReal === false) return;

        $candidate = realpath($publicReal . $path);
        if ($candidate === false) return;
        if (!str_starts_with($candidate, $publicReal . DIRECTORY_SEPARATOR)) return;
        if (!is_file($candidate)) return;

        $ext = strtolower((string)pathinfo($candidate, PATHINFO_EXTENSION));
        $contentTypes = [
            'css' => 'text/css; charset=UTF-8',
            'js' => 'text/javascript; charset=UTF-8',
            'mjs' => 'text/javascript; charset=UTF-8',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'svg' => 'image/svg+xml',
            'ico' => 'image/x-icon',
            'woff2' => 'font/woff2',
            'woff' => 'font/woff',
            'ttf' => 'font/ttf',
        ];

        $ct = $contentTypes[$ext] ?? 'application/octet-stream';
        header('Content-Type: ' . $ct);
        header('Content-Length: ' . (string)filesize($candidate));
        header('Cache-Control: public, max-age=3600');
        readfile($candidate);
        exit;
    }
}

StaticFile::maybeServeFromPublicDir(__DIR__);

require __DIR__ . '/../src/bootstrap.php';

try {
    $phpSsrEnv = realpath(__DIR__ . '/../.env');
    $rootEnv = realpath(__DIR__ . '/../../.env');
    $envPath = $phpSsrEnv ?: ($rootEnv ?: null);

    $env = new Env($envPath);
    $forceSecureRaw = trim($env->get('FORCE_SECURE_COOKIES', ''));
    $forceSecure = null;
    if ($forceSecureRaw !== '') {
        $forceSecure = in_array(strtolower($forceSecureRaw), ['1', 'true', 'yes', 'on'], true);
    }

    $config = [
        'db' => [
            'host' => $env->get('DB_HOST', '127.0.0.1'),
            'port' => (int)$env->get('DB_PORT', '5432'),
            'database' => $env->get('DB_DATABASE', ''),
            'username' => $env->get('DB_USERNAME', ''),
            'password' => $env->get('DB_PASSWORD', ''),
            'sslmode' => $env->get('DB_SSLMODE', ''),
            'persistent' => $env->getBool('DB_PERSISTENT', false),
        ],
        'supabase' => [
            'url' => $env->get('VITE_SUPABASE_URL', ''),
            'anon_key' => $env->get('VITE_SUPABASE_ANON_KEY', ''),
        ],
        'app' => [
            'base_url' => rtrim($env->get('APP_URL', ''), '/'),
            'session_name' => $env->get('SESSION_NAME', 'sadi_session'),
            'dashboard_cache_ttl' => (int)$env->get('DASHBOARD_CACHE_TTL', '60'),
            'setup_token' => $env->get('SETUP_TOKEN', ''),
            'force_secure_cookies' => $forceSecure,
        ],
    ];

    $db = new Db($config['db']);
    $view = new View(__DIR__ . '/../resources/views');

    Session::start($config);

    $router = new Router($db, $view, $config);
    require __DIR__ . '/../routes/web.php';

    $request = Request::fromGlobals();
    $response = $router->dispatch($request);

    Response::emit($response);
} catch (\Throwable $e) {
    http_response_code(200);
    header('Content-Type: text/html; charset=UTF-8');
    $msg = htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="es-CO"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Error - SADI</title><link rel="stylesheet" href="/assets/app.css"/></head><body class="min-h-screen bg-gray-50"><div class="min-h-screen flex items-center justify-center p-4"><div class="max-w-xl w-full bg-white rounded-xl shadow-md p-6"><h1 class="text-xl font-bold text-gray-900">Error de configuración</h1><p class="mt-2 text-sm text-gray-600">No se pudo iniciar la aplicación por un problema de configuración.</p><div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"><div class="font-semibold mb-1">Detalle</div><div>' . $msg . '</div></div><div class="mt-4 text-sm text-gray-600"><div class="font-semibold">Verifica que existan estas variables:</div><div class="mt-1 font-mono text-xs text-gray-700">DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD</div></div></div></div></body></html>';
}
