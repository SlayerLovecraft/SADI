<?php

declare(strict_types=1);

$mode = (string)($mode ?? 'create');
$isEdit = $mode === 'edit';
$campaignId = (string)($campaignId ?? '');
$title = ($isEdit ? 'Editar Campaña' : 'Nueva Campaña') . ' - SADI';
$values = (isset($values) && is_array($values)) ? $values : [];
$error = isset($error) ? (string)$error : '';

$v = static function (string $key) use ($values): string {
    $val = $values[$key] ?? '';
    return is_string($val) ? $val : '';
};

$action = $isEdit ? ('/campaigns/' . rawurlencode($campaignId)) : '/campaigns';

ob_start();
?>
<div class="min-h-screen bg-gray-50">
  <div class="max-w-3xl mx-auto p-6 space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900"><?= $isEdit ? 'Editar Campaña' : 'Nueva Campaña' ?></h1>
        <p class="text-xs text-gray-400 mt-1"><?= htmlspecialchars((string)($user['email'] ?? ''), ENT_QUOTES, 'UTF-8') ?> · hospital_admin</p>
      </div>
      <a href="/campaigns" class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors">Volver</a>
    </div>

    <?php if ($error !== '') : ?>
      <div class="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
        <?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?>
      </div>
    <?php endif; ?>

    <form method="post" action="<?= htmlspecialchars($action, ENT_QUOTES, 'UTF-8') ?>" class="bg-white rounded-xl shadow-md p-6 space-y-5">
      <input type="hidden" name="_csrf" value="<?= htmlspecialchars((string)($csrf ?? ''), ENT_QUOTES, 'UTF-8') ?>" />

      <div>
        <label class="block text-sm font-medium text-gray-700">Nombre</label>
        <input name="nombre" value="<?= htmlspecialchars($v('nombre'), ENT_QUOTES, 'UTF-8') ?>" required
          class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Estado</label>
          <input name="estado" value="<?= htmlspecialchars($v('estado'), ENT_QUOTES, 'UTF-8') ?>" placeholder="Programada/Activa/Completada"
            class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Fecha Programada</label>
          <input name="fecha_programada" type="date" value="<?= htmlspecialchars($v('fecha_programada'), ENT_QUOTES, 'UTF-8') ?>"
            class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Hora Programada</label>
          <input name="hora_programada" type="time" value="<?= htmlspecialchars($v('hora_programada'), ENT_QUOTES, 'UTF-8') ?>"
            class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
      </div>

      <div class="flex items-center justify-end gap-3">
        <a href="/campaigns" class="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-gray-800">Cancelar</a>
        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <?= $isEdit ? 'Guardar cambios' : 'Crear campaña' ?>
        </button>
      </div>
    </form>
  </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';
