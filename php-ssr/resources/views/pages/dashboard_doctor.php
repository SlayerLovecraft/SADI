<?php

declare(strict_types=1);

$title = 'Dashboard Doctor - SADI';
ob_start();
?>
<div class="max-w-6xl mx-auto space-y-6">
  <div>
    <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
    <p class="text-gray-600 mt-1"><?= htmlspecialchars((string)($message ?? ''), ENT_QUOTES, 'UTF-8') ?></p>
  </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';
