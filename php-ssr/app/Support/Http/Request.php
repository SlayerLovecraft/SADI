<?php

declare(strict_types=1);

namespace App\Support\Http;

final class Request
{
    public string $method;
    public string $path;
    public array $query;
    public array $post;
    public array $cookies;
    public array $server;
    public array $params = [];

    private function __construct() {}

    public static function fromGlobals(): self
    {
        $self = new self();
        $self->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = parse_url($uri, PHP_URL_PATH);
        $self->path = $path ? (string)$path : '/';
        $self->query = $_GET ?? [];
        $self->post = $_POST ?? [];
        $self->cookies = $_COOKIE ?? [];
        $self->server = $_SERVER ?? [];
        $self->params = [];
        return $self;
    }
}
