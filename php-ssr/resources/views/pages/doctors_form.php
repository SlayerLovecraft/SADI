<?php

declare(strict_types=1);

$mode = isset($mode) ? (string)$mode : 'create';
$doctorId = isset($doctorId) ? (string)$doctorId : '';
$error = isset($error) ? (string)$error : '';
$csrfToken = isset($csrf) ? (string)$csrf : '';
$values = (isset($values) && is_array($values)) ? $values : [];
$specialtyOptions = (isset($specialtyOptions) && is_array($specialtyOptions)) ? $specialtyOptions : [];

$title = ($mode === 'edit' ? 'Editar Doctor' : 'Agregar Doctor') . ' - SADI';

ob_start();
?>
<div class="max-w-3xl mx-auto space-y-6">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900"><?= $mode === 'edit' ? 'Editar Doctor' : 'Agregar Doctor' ?></h1>
      <p class="text-gray-500 mt-1">Los doctores se asignan al hospital actual automáticamente.</p>
    </div>
    <div>
      <a href="/doctors" class="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors">Volver</a>
    </div>
  </div>

  <?php if ($error !== '') : ?>
    <div class="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
  <?php endif; ?>

  <form method="post" action="<?= $mode === 'edit' ? '/doctors/' . htmlspecialchars($doctorId, ENT_QUOTES, 'UTF-8') : '/doctors' ?>" class="bg-white rounded-xl shadow-md p-6 space-y-5">
    <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
      <input name="doctor_name" value="<?= htmlspecialchars((string)($values['doctor_name'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
        placeholder="Opcional"
        class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
      <input name="doctor_email" type="email" required
        value="<?= htmlspecialchars((string)($values['doctor_email'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
        placeholder="doctor@hospital.com"
        class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña <?= $mode === 'edit' ? '(dejar en blanco para no cambiar)' : '*' ?></label>
      <input name="doctor_password" type="text" <?= $mode === 'create' ? 'required' : '' ?>
        value=""
        placeholder="<?= $mode === 'create' ? 'Escribe una contraseña (mínimo 8 caracteres)' : 'Nueva contraseña (opcional)' ?>"
        class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Especialidad *</label>
      <select name="doctor_specialty" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
        <?php
        $selected = (string)($values['doctor_specialty'] ?? 'general');
        foreach ($specialtyOptions as $k => $label) :
        ?>
          <option value="<?= htmlspecialchars((string)$k, ENT_QUOTES, 'UTF-8') ?>" <?= $selected === (string)$k ? 'selected' : '' ?>>
            <?= htmlspecialchars((string)$label, ENT_QUOTES, 'UTF-8') ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>

    <div class="flex items-center gap-2">
      <?php $checked = (bool)($values['is_active'] ?? true); ?>
      <input id="is_active" name="is_active" type="checkbox" value="1" <?= $checked ? 'checked' : '' ?> class="h-4 w-4" />
      <label for="is_active" class="text-sm text-gray-700">Activo</label>
    </div>

    <div class="flex items-center justify-end gap-3 pt-2">
      <a href="/doctors" class="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors">Cancelar</a>
      <button class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors">
        <?= $mode === 'edit' ? 'Guardar Cambios' : 'Crear Doctor' ?>
      </button>
    </div>
  </form>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';

