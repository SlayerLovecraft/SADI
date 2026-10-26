<?php

declare(strict_types=1);

$title = 'Plantillas SMS - SADI';
$filters = (isset($filters) && is_array($filters)) ? $filters : ['q' => '', 'categoria' => ''];
$rows = (isset($rows) && is_array($rows)) ? $rows : [];
$meta = (isset($meta) && is_array($meta)) ? $meta : ['page' => 1, 'per_page' => 25, 'has_prev' => false, 'has_next' => false];
$csrfToken = isset($csrf) ? (string)$csrf : '';
$categories = (isset($categories) && is_array($categories)) ? $categories : [];
$errorMsg = isset($error) ? (string)$error : '';

ob_start();
?>
<div class="max-w-6xl mx-auto space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Plantillas SMS</h1>
      <p class="text-gray-500 mt-1">Gestiona mensajes reutilizables para campañas.</p>
    </div>
    <div class="flex items-center gap-3">
      <a href="/templates/create" class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors">Nueva Plantilla</a>
    </div>
  </div>

  <?php if ($errorMsg !== '') : ?>
    <div class="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4"><?= htmlspecialchars($errorMsg, ENT_QUOTES, 'UTF-8') ?></div>
  <?php endif; ?>

  <form method="get" class="bg-white rounded-xl shadow-md p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
    <input name="q" value="<?= htmlspecialchars((string)($filters['q'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
      placeholder="Buscar (nombre, mensaje, categoría)"
      class="md:col-span-3 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    <select name="categoria" class="md:col-span-2 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
      <option value="">Todas las categorías</option>
      <?php $selected = (string)($filters['categoria'] ?? ''); ?>
      <?php foreach ($categories as $cat) : ?>
        <option value="<?= htmlspecialchars((string)$cat, ENT_QUOTES, 'UTF-8') ?>" <?= $selected === (string)$cat ? 'selected' : '' ?>><?= htmlspecialchars((string)$cat, ENT_QUOTES, 'UTF-8') ?></option>
      <?php endforeach; ?>
    </select>
    <button class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors">Filtrar</button>
  </form>

  <div class="bg-white rounded-xl shadow-md overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Nombre</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Categoría</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Mensaje</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Registro</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700"></th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <?php if (count($rows) === 0) : ?>
            <tr>
              <td colspan="5" class="px-4 py-8 text-center text-gray-500">Sin resultados</td>
            </tr>
          <?php else : ?>
            <?php foreach ($rows as $r) : ?>
              <?php
              $msg = (string)($r['mensaje'] ?? '');
              $preview = mb_strlen($msg) > 80 ? (mb_substr($msg, 0, 80) . '…') : $msg;
              ?>
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 font-medium text-gray-900"><?= htmlspecialchars((string)($r['nombre'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-700"><?= htmlspecialchars((string)($r['categoria'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-700"><?= htmlspecialchars($preview, ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-500"><?= htmlspecialchars((string)($r['created_at'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-3">
                    <a class="text-sm text-blue-600 hover:text-blue-800" href="/templates/<?= htmlspecialchars((string)($r['id'] ?? ''), ENT_QUOTES, 'UTF-8') ?>/edit">Editar</a>
                    <form method="post" action="/templates/<?= htmlspecialchars((string)($r['id'] ?? ''), ENT_QUOTES, 'UTF-8') ?>/delete" onsubmit="return confirm('¿Eliminar esta plantilla?');">
                      <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />
                      <button class="text-sm text-red-600 hover:text-red-800">Eliminar</button>
                    </form>
                  </div>
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

