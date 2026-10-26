<?php

declare(strict_types=1);

$mode = isset($mode) ? (string)$mode : 'create';
$segmentId = isset($segmentId) ? (string)$segmentId : '';
$error = isset($error) ? (string)$error : '';
$csrfToken = isset($csrf) ? (string)$csrf : '';
$values = (isset($values) && is_array($values)) ? $values : [];

$title = ($mode === 'edit' ? 'Editar Segmento' : 'Nuevo Segmento') . ' - SADI';

ob_start();
?>
<div class="max-w-3xl mx-auto space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900"><?= $mode === 'edit' ? 'Editar Segmento' : 'Nuevo Segmento' ?></h1>
      <p class="text-gray-500 mt-1">Define filtros para agrupar pacientes.</p>
    </div>
    <div>
      <a href="/segmentation" class="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors">Volver</a>
    </div>
  </div>

  <?php if ($error !== '') : ?>
    <div class="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
  <?php endif; ?>

  <form method="post" action="<?= $mode === 'edit' ? '/segmentation/' . htmlspecialchars($segmentId, ENT_QUOTES, 'UTF-8') : '/segmentation' ?>" class="bg-white rounded-xl shadow-md p-6 space-y-5">
    <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
      <input name="nombre" required
        value="<?= htmlspecialchars((string)($values['nombre'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
        placeholder="Ej: Adultos Hipertensión - Cali"
        class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Edad mínima</label>
        <input name="edad_min" inputmode="numeric"
          value="<?= htmlspecialchars((string)($values['edad_min'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
          placeholder="Opcional"
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Edad máxima</label>
        <input name="edad_max" inputmode="numeric"
          value="<?= htmlspecialchars((string)($values['edad_max'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
          placeholder="Opcional"
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
        <?php $sexo = (string)($values['sexo'] ?? 'Todos'); ?>
        <select name="sexo" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <?php foreach (['Todos', 'Masculino', 'Femenino'] as $opt) : ?>
            <option value="<?= htmlspecialchars($opt, ENT_QUOTES, 'UTF-8') ?>" <?= $sexo === $opt ? 'selected' : '' ?>><?= htmlspecialchars($opt, ENT_QUOTES, 'UTF-8') ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
        <input name="ciudad"
          value="<?= htmlspecialchars((string)($values['ciudad'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
          placeholder="Opcional"
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Programa</label>
        <input name="programa"
          value="<?= htmlspecialchars((string)($values['programa'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
          placeholder="Opcional"
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>
    </div>

    <div class="flex items-center justify-end gap-3 pt-2">
      <a href="/segmentation" class="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors">Cancelar</a>
      <button class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors">
        <?= $mode === 'edit' ? 'Guardar Cambios' : 'Crear Segmento' ?>
      </button>
    </div>
  </form>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';

