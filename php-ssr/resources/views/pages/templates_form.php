<?php

declare(strict_types=1);

$mode = isset($mode) ? (string)$mode : 'create';
$templateId = isset($templateId) ? (string)$templateId : '';
$error = isset($error) ? (string)$error : '';
$csrfToken = isset($csrf) ? (string)$csrf : '';
$values = (isset($values) && is_array($values)) ? $values : [];
$categories = (isset($categories) && is_array($categories)) ? $categories : [];

$title = ($mode === 'edit' ? 'Editar Plantilla' : 'Nueva Plantilla') . ' - SADI';

ob_start();
?>
<div class="max-w-3xl mx-auto space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900"><?= $mode === 'edit' ? 'Editar Plantilla' : 'Nueva Plantilla' ?></h1>
      <p class="text-gray-500 mt-1">Usa variables: {nombre}, {fecha_cita}, {hora_cita}, {programa}, {ciudad}, {hospital}</p>
    </div>
    <div>
      <a href="/templates" class="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors">Volver</a>
    </div>
  </div>

  <?php if ($error !== '') : ?>
    <div class="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
  <?php endif; ?>

  <form method="post" action="<?= $mode === 'edit' ? '/templates/' . htmlspecialchars($templateId, ENT_QUOTES, 'UTF-8') : '/templates' ?>" class="bg-white rounded-xl shadow-md p-6 space-y-5">
    <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
      <input name="nombre" required
        value="<?= htmlspecialchars((string)($values['nombre'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
        placeholder="Ej: Recordatorio cita"
        class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
      <?php $selected = (string)($values['categoria'] ?? 'General'); ?>
      <select name="categoria" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
        <?php foreach ($categories as $cat) : ?>
          <option value="<?= htmlspecialchars((string)$cat, ENT_QUOTES, 'UTF-8') ?>" <?= $selected === (string)$cat ? 'selected' : '' ?>><?= htmlspecialchars((string)$cat, ENT_QUOTES, 'UTF-8') ?></option>
        <?php endforeach; ?>
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Mensaje *</label>
      <textarea name="mensaje" required rows="6"
        placeholder="Escribe el mensaje (SMS estándar 160 caracteres)"
        class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"><?= htmlspecialchars((string)($values['mensaje'] ?? ''), ENT_QUOTES, 'UTF-8') ?></textarea>
      <?php $len = mb_strlen((string)($values['mensaje'] ?? '')); ?>
      <div class="text-xs text-gray-500 mt-1">Caracteres: <?= (int)$len ?></div>
    </div>

    <div class="flex items-center justify-end gap-3 pt-2">
      <a href="/templates" class="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors">Cancelar</a>
      <button class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors">
        <?= $mode === 'edit' ? 'Guardar Cambios' : 'Crear Plantilla' ?>
      </button>
    </div>
  </form>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';

