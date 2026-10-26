<?php

declare(strict_types=1);

$meta = (isset($meta) && is_array($meta)) ? $meta : [];
$filters = (isset($filters) && is_array($filters)) ? $filters : [];

$page = (int)($meta['page'] ?? 1);
$perPage = (int)($meta['per_page'] ?? 25);
$hasPrev = (bool)($meta['has_prev'] ?? ($page > 1));
$hasNext = (bool)($meta['has_next'] ?? false);

$buildUrl = static function (int $targetPage) use ($filters, $perPage): string {
    $params = [];
    foreach ($filters as $k => $v) {
        if ($v === null) continue;
        $v = is_string($v) ? trim($v) : $v;
        if ($v === '') continue;
        $params[$k] = $v;
    }
    $params['page'] = $targetPage;
    $params['per_page'] = $perPage;
    return '?' . http_build_query($params);
};

?>
<div class="flex items-center justify-between">
  <div class="text-sm text-gray-500">
    Página <?= $page ?>
  </div>
  <div class="flex items-center gap-2">
    <a href="<?= htmlspecialchars($buildUrl(max(1, $page - 1)), ENT_QUOTES, 'UTF-8') ?>"
       class="px-3 py-2 rounded-lg border text-sm <?= $hasPrev ? 'bg-white hover:bg-gray-50 text-gray-800' : 'bg-gray-100 text-gray-400 pointer-events-none' ?>">
      Anterior
    </a>
    <a href="<?= htmlspecialchars($buildUrl($page + 1), ENT_QUOTES, 'UTF-8') ?>"
       class="px-3 py-2 rounded-lg border text-sm <?= $hasNext ? 'bg-white hover:bg-gray-50 text-gray-800' : 'bg-gray-100 text-gray-400 pointer-events-none' ?>">
      Siguiente
    </a>
  </div>
</div>
