<?php

declare(strict_types=1);

namespace App\View;

final class View
{
    private string $basePath;

    public function __construct(string $basePath)
    {
        $this->basePath = rtrim($basePath, DIRECTORY_SEPARATOR);
    }

    public function render(string $name, array $data = []): string
    {
        $file = $this->basePath . DIRECTORY_SEPARATOR . str_replace(['.', '\\'], '/', $name) . '.php';
        if (!is_file($file)) {
            return '';
        }

        ob_start();
        extract($data, EXTR_SKIP);
        require $file;
        return (string)ob_get_clean();
    }
}
