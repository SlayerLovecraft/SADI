<?php

declare(strict_types=1);

$title = 'Pacientes - SADI';
$filters = (isset($filters) && is_array($filters)) ? $filters : ['q' => '', 'program' => '', 'city' => ''];
$rows = (isset($rows) && is_array($rows)) ? $rows : [];
$meta = (isset($meta) && is_array($meta)) ? $meta : ['page' => 1, 'per_page' => 25, 'has_prev' => false, 'has_next' => false];

ob_start();
?>
<div class="max-w-6xl mx-auto space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Pacientes</h1>
    </div>
    <div class="flex items-center gap-3">
      <a href="/patients/create" class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors">Nuevo</a>
    </div>
  </div>

  <form method="get" class="bg-white rounded-xl shadow-md p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
    <input name="q" value="<?= htmlspecialchars((string)($filters['q'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
      placeholder="Buscar (nombre, doc, email, teléfono)"
      class="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    <input name="program" value="<?= htmlspecialchars((string)($filters['program'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
      placeholder="Programa"
      class="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    <input name="city" value="<?= htmlspecialchars((string)($filters['city'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
      placeholder="Ciudad"
      class="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    <button class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors">Filtrar</button>
  </form>

  <div class="bg-white rounded-xl shadow-md overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Nombre</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Documento</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Email</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Teléfono</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Programa</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Ciudad</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-700">Registro</th>
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
                <td class="px-4 py-3 font-medium text-gray-900"><?= htmlspecialchars((string)($r['name'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-700"><?= htmlspecialchars((string)($r['document'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-700"><?= htmlspecialchars((string)($r['email'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-700"><?= htmlspecialchars((string)($r['phone'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-700"><?= htmlspecialchars((string)($r['program'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-700"><?= htmlspecialchars((string)($r['city'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-gray-500"><?= htmlspecialchars((string)($r['created_at'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>
                <td class="px-4 py-3 text-right">
                  <a class="text-sm text-blue-600 hover:text-blue-800" href="/patients/<?= htmlspecialchars((string)($r['patient_id'] ?? ''), ENT_QUOTES, 'UTF-8') ?>/edit">Editar</a>
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
