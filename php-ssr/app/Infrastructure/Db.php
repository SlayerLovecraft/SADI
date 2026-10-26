<?php

declare(strict_types=1);

namespace App\Infrastructure;

use PDO;

final class Db
{
    private ?PDO $pdo = null;
    private array $cfg;

    public function __construct(array $cfg)
    {
        $this->cfg = $cfg;
    }

    public function pdo(): PDO
    {
        if ($this->pdo === null) {
            $this->pdo = $this->connect();
        }
        return $this->pdo;
    }

    public function fetchOne(string $sql, array $params = []): ?array
    {
        $stmt = $this->pdo()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public function fetchAll(string $sql, array $params = []): array
    {
        $stmt = $this->pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function execute(string $sql, array $params = []): int
    {
        $stmt = $this->pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public function paginateNoCount(string $baseSql, array $params, int $page, int $perPage): array
    {
        $page = max(1, $page);
        $perPage = min(max(1, $perPage), 200);
        $offset = ($page - 1) * $perPage;
        $limitPlusOne = $perPage + 1;

        $pagedSql = $baseSql . " LIMIT :limit OFFSET :offset";
        $stmt = $this->pdo()->prepare($pagedSql);

        foreach ($params as $k => $v) {
            $stmt->bindValue(is_int($k) ? $k + 1 : (":" . $k), $v, is_int($v) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit', $limitPlusOne, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

        $stmt->execute();
        $rows = $stmt->fetchAll();

        $hasNext = count($rows) > $perPage;
        if ($hasNext) {
            array_pop($rows);
        }

        return [
            'data' => $rows,
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'has_next' => $hasNext,
                'has_prev' => $page > 1,
            ],
        ];
    }

    private function connect(): PDO
    {
        $cfg = $this->cfg;

        $host = (string)($cfg['host'] ?? '127.0.0.1');
        $port = (int)($cfg['port'] ?? 5432);
        $db = (string)($cfg['database'] ?? '');
        $user = (string)($cfg['username'] ?? '');
        $pass = (string)($cfg['password'] ?? '');
        $sslmode = (string)($cfg['sslmode'] ?? '');

        $host = trim($host);
        if (str_starts_with($host, 'http://') || str_starts_with($host, 'https://')) {
            $parsed = parse_url($host);
            if (is_array($parsed) && !empty($parsed['host'])) {
                $host = (string)$parsed['host'];
            }
        }
        $host = rtrim($host, '/');

        $missing = [];
        if (trim($host) === '') $missing[] = 'DB_HOST';
        if ($port <= 0) $missing[] = 'DB_PORT';
        if (trim($db) === '') $missing[] = 'DB_DATABASE';
        if (trim($user) === '') $missing[] = 'DB_USERNAME';
        if ($pass === '') $missing[] = 'DB_PASSWORD';
        if (!empty($missing)) {
            throw new \InvalidArgumentException('Faltan credenciales de PostgreSQL: ' . implode(', ', $missing));
        }

        $dsn = "pgsql:host={$host};port={$port};dbname={$db};options='--client_encoding=UTF8'";
        if (trim($sslmode) !== '') {
            $dsn .= ";sslmode={$sslmode}";
        }

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ];

        if (!empty($cfg['persistent'])) {
            $options[PDO::ATTR_PERSISTENT] = true;
        }

        return new PDO($dsn, $user, $pass, $options);
    }
}
