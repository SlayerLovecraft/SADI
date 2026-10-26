<?php

declare(strict_types=1);

namespace App\Support;

final class Env
{
    private array $fileVars = [];

    public function __construct(?string $dotenvPath = null)
    {
        if ($dotenvPath && is_file($dotenvPath)) {
            $this->fileVars = $this->parseDotenv($dotenvPath);
        }
    }

    public function get(string $key, ?string $default = null): ?string
    {
        $val = getenv($key);
        if ($val !== false) return (string)$val;
        if (array_key_exists($key, $this->fileVars)) return $this->fileVars[$key];
        return $default;
    }

    public function getBool(string $key, bool $default = false): bool
    {
        $val = $this->get($key, null);
        if ($val === null) return $default;
        $norm = strtolower(trim($val));
        if ($norm === '1' || $norm === 'true' || $norm === 'yes' || $norm === 'on') return true;
        if ($norm === '0' || $norm === 'false' || $norm === 'no' || $norm === 'off') return false;
        return $default;
    }

    private function parseDotenv(string $path): array
    {
        $out = [];
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) continue;
            $pos = strpos($line, '=');
            if ($pos === false) continue;
            $k = trim(substr($line, 0, $pos));
            $v = trim(substr($line, $pos + 1));
            $v = trim($v, "\"'`");
            $out[$k] = $v;
        }
        return $out;
    }
}
