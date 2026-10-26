<?php

declare(strict_types=1);

$title = '404 - SADI';
ob_start();
?>
<div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
  <div class="bg-white rounded-xl shadow-md p-8 max-w-md w-full text-center">
    <h1 class="text-2xl font-bold text-gray-900">Página no encontrada</h1>
    <p class="text-gray-600 mt-2">Ruta: <?= htmlspecialchars((string)($path ?? ''), ENT_QUOTES, 'UTF-8') ?></p>
    <a href="/login" class="inline-block mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      Ir al Login
    </a>
  </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';
