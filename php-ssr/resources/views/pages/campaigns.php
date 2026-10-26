<?php

declare(strict_types=1);

$title = 'Campañas - SADI';
$filters = (isset($filters) && is_array($filters)) ? $filters : ['q' => '', 'status' => ''];
$rows = (isset($rows) && is_array($rows)) ? $rows : [];
$meta = (isset($meta) && is_array($meta)) ? $meta : ['page' => 1, 'per_page' => 25, 'has_prev' => false, 'has_next' => false];

ob_start();
?>
<div class="max-w-6xl mx-auto space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Campañas</h1>
    </div>
    <div class="flex items-center gap-3">
      <a href="/campaigns/create" class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors">Nueva</a>
    </div>
  </div>

  <form method="get" class="bg-white rounded-xl shadow-md p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
    <input name="q" value="<?= htmlspecialchars((string)($filters['q'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
      placeholder="Buscar por nombre"
      class="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    <input name="status" value="<?= htmlspecialchars((string)($filters['status'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
      placeholder="Estado (ej. Programada, Activa, Completada)"
      class="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    <button class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors">Filtrar</button>
  </form>

  <div class="bg-white rounded-xl shadow-md overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Nombre</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Estado</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Creación</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Programada</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Destinatarios</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Entregados</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Fallidos</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700"></th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <?php if (count($rows) === 0) : ?>
            <tr>
              <td colspan="8" class="px-4 py-8 text-center text-gray-500">Sin resultados</td>
            </tr>
          <?php else : ?>
            <?php foreach ($rows as $r) : ?>
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 font-medium text-gray-900"><?= htmlspecialchars((string)($r['nombre'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-700"><?= htmlspecialchars((string)($r['estado'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-500"><?= htmlspecialchars((string)($r['created_at'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-500">
                  <?= htmlspecialchars((string)($r['fecha_programada'] ?? ''), ENT_QUOTES, 'UTF-8') ?>
                  <?= htmlspecialchars((string)($r['hora_programada'] ?? ''), ENT_QUOTES, 'UTF-8') ?>
                </td>
                <td class="px-4 py-3 text-gray-700"><?= (int)($r['destinatarios'] ?? 0) ?></td>
                <td class="px-4 py-3 text-gray-700"><?= (int)($r['entregados'] ?? 0) ?></td>
                <td class="px-4 py-3 text-gray-700"><?= (int)($r['fallidos'] ?? 0) ?></td>
                <td class="px-4 py-3 text-right">
                  <a class="text-sm text-blue-600 hover:text-blue-800" href="/campaigns/<?= htmlspecialchars((string)($r['id'] ?? ''), ENT_QUOTES, 'UTF-8') ?>/edit">Editar</a>
                </td>
              </tr>
            <?php endforeach; ?>
          <?php endif; ?>
        </tbody>
      </table>
    </div>
    <div class="p-4 border-t">
      <?php require __DIR__ . '/../components/pagination.php'; ?>
    </div>
  </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';
