<?php

declare(strict_types=1);

namespace App\Support\Routing;

use App\Infrastructure\Db;
use App\Support\Http\Request;
use App\Support\Http\Response;
use App\View\View;

final class Router
{
    private array $routes = [];
    private array $dynamicRoutes = [];
    private Db $db;
    private View $view;
    private array $config;

    public function __construct(Db $db, View $view, array $config)
    {
        $this->db = $db;
        $this->view = $view;
        $this->config = $config;
    }

    public function get(string $path, callable $handler, array $middlewares = []): void
    {
        $this->addRoute('GET', $path, $handler, $middlewares);
    }

    public function post(string $path, callable $handler, array $middlewares = []): void
    {
        $this->addRoute('POST', $path, $handler, $middlewares);
    }

    public function dispatch(Request $request): Response
    {
        $method = $request->method;
        $methodRoutes = $this->routes[$method] ?? [];
        $route = $methodRoutes[$request->path] ?? null;

        if (!$route) {
            $dynamic = $this->dynamicRoutes[$method] ?? [];
            foreach ($dynamic as $candidate) {
                if (!preg_match($candidate['regex'], $request->path, $matches)) {
                    continue;
                }
                $params = [];
                foreach ($candidate['params'] as $name) {
                    if (array_key_exists($name, $matches)) {
                        $params[$name] = $matches[$name];
                    }
                }
                $request->params = $params;
                $route = $candidate;
                break;
            }
        }

        if (!$route) {
            return Response::html($this->view->render('pages/error_404', ['path' => $request->path]), 404);
        }

        $middlewares = $route['middlewares'] ?? [];
        foreach ($middlewares as $mw) {
            $result = $mw($request, $this->db, $this->view, $this->config);
            if ($result instanceof Response) {
                return $result;
            }
        }

        $handler = $route['handler'];
        return $handler($request, $this->db, $this->view, $this->config);
    }

    private function addRoute(string $method, string $path, callable $handler, array $middlewares): void
    {
        if (str_contains($path, '{')) {
            [$regex, $params] = $this->compilePath($path);
            $this->dynamicRoutes[$method][] = [
                'handler' => $handler,
                'middlewares' => $middlewares,
                'regex' => $regex,
                'params' => $params,
            ];
            return;
        }

        $this->routes[$method][$path] = [
            'handler' => $handler,
            'middlewares' => $middlewares,
        ];
    }

    private function compilePath(string $path): array
    {
        $params = [];
        $pattern = preg_replace_callback('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', static function (array $m) use (&$params): string {
            $params[] = $m[1];
            return '(?P<' . $m[1] . '>[^\/]+)';
        }, $path);

        $regex = '#^' . $pattern . '$#';
        return [$regex, $params];
    }
}
