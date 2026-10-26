<?php

declare(strict_types=1);

$title = 'Doctores - SADI';
$filters = (isset($filters) && is_array($filters)) ? $filters : ['q' => ''];
$rows = (isset($rows) && is_array($rows)) ? $rows : [];
$meta = (isset($meta) && is_array($meta)) ? $meta : ['page' => 1, 'per_page' => 25, 'has_prev' => false, 'has_next' => false];
$csrfToken = (isset($csrf) ? (string)$csrf : '');
$specialtyOptions = (isset($specialtyOptions) && is_array($specialtyOptions)) ? $specialtyOptions : [];

ob_start();
?>
<div class="max-w-6xl mx-auto space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Doctores</h1>
      <p class="text-gray-500 mt-1">Doctores de tu hospital (<?= count($rows) ?>)</p>
    </div>
    <div class="flex items-center gap-3">
      <a href="/doctors/create" class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors">Agregar Doctor</a>
    </div>
  </div>

  <form method="get" class="bg-white rounded-xl shadow-md p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
    <input name="q" value="<?= htmlspecialchars((string)($filters['q'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
      placeholder="Buscar (nombre, email, especialidad)"
      class="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    <div class="md:col-span-2"></div>
    <button class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors">Filtrar</button>
  </form>

  <div class="bg-white rounded-xl shadow-md overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Nombre</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Email</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Especialidad</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Estado</th>
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
              $specialtyKey = (string)($r['doctor_specialty'] ?? '');
              $specialtyLabel = $specialtyKey !== '' && isset($specialtyOptions[$specialtyKey]) ? (string)$specialtyOptions[$specialtyKey] : $specialtyKey;
              $isActive = (bool)($r['is_active'] ?? true);
              ?>
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 font-medium text-gray-900"><?= htmlspecialchars((string)($r['doctor_name'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-700"><?= htmlspecialchars((string)($r['doctor_email'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-700"><?= htmlspecialchars($specialtyLabel, ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3">
                  <?php if ($isActive) : ?>
                    <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Activo</span>
                  <?php else : ?>
                    <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">Inactivo</span>
                  <?php endif; ?>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-3">
                    <a class="text-sm text-blue-600 hover:text-blue-800"
                      href="/doctors/<?= htmlspecialchars((string)($r['doctor_id'] ?? ''), ENT_QUOTES, 'UTF-8') ?>/edit">Editar</a>
                    <form method="post" action="/doctors/<?= htmlspecialchars((string)($r['doctor_id'] ?? ''), ENT_QUOTES, 'UTF-8') ?>/delete" onsubmit="return confirm('¿Eliminar este doctor?');">
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

