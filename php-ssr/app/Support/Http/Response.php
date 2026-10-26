<?php

declare(strict_types=1);

namespace App\Support\Http;

final class Response
{
    public int $status;
    public array $headers;
    public string $body;

    public function __construct(string $body = '', int $status = 200, array $headers = [])
    {
        $this->body = $body;
        $this->status = $status;
        $this->headers = $headers;
    }

    public static function html(string $html, int $status = 200, array $headers = []): self
    {
        $headers['Content-Type'] = $headers['Content-Type'] ?? 'text/html; charset=UTF-8';
        return new self($html, $status, $headers);
    }

    public static function redirect(string $to, int $status = 302): self
    {
        return new self('', $status, ['Location' => $to]);
    }

    public static function emit(self $response): void
    {
        http_response_code($response->status);
        foreach ($response->headers as $k => $v) {
            header($k . ': ' . $v);
        }
        echo $response->body;
    }
}
