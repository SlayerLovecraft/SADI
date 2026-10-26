<?php

declare(strict_types=1);

$mode = (string)($mode ?? 'create');
$isEdit = $mode === 'edit';
$interactionId = (string)($interactionId ?? '');
$title = ($isEdit ? 'Editar Interacción' : 'Nueva Interacción') . ' - SADI';
$values = (isset($values) && is_array($values)) ? $values : [];
$error = isset($error) ? (string)$error : '';

$v = static function (string $key) use ($values): string {
    $val = $values[$key] ?? '';
    return is_string($val) ? $val : '';
};

$action = $isEdit ? ('/interactions/' . rawurlencode($interactionId)) : '/interactions';

ob_start();
?>
<div class="min-h-screen bg-gray-50">
  <div class="max-w-3xl mx-auto p-6 space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900"><?= $isEdit ? 'Editar Interacción' : 'Nueva Interacción' ?></h1>
        <p class="text-xs text-gray-400 mt-1"><?= htmlspecialchars((string)($user['email'] ?? ''), ENT_QUOTES, 'UTF-8') ?> · hospital_admin</p>
      </div>
      <a href="/interactions" class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors">Volver</a>
    </div>

    <?php if ($error !== '') : ?>
      <div class="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
        <?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?>
      </div>
    <?php endif; ?>

    <?php if ($isEdit) : ?>
      <div class="bg-white rounded-xl shadow-md p-4 text-sm text-gray-600">
        <div class="font-semibold text-gray-900"><?= htmlspecialchars($v('patient_name'), ENT_QUOTES, 'UTF-8') ?></div>
        <div class="text-xs text-gray-500"><?= htmlspecialchars($v('patient_email'), ENT_QUOTES, 'UTF-8') ?></div>
      </div>
    <?php endif; ?>

    <form method="post" action="<?= htmlspecialchars($action, ENT_QUOTES, 'UTF-8') ?>" class="bg-white rounded-xl shadow-md p-6 space-y-5">
      <input type="hidden" name="_csrf" value="<?= htmlspecialchars((string)($csrf ?? ''), ENT_QUOTES, 'UTF-8') ?>" />

      <?php if (!$isEdit) : ?>
        <div>
          <label class="block text-sm font-medium text-gray-700">Documento o correo del paciente</label>
          <input name="patient_identifier" value="<?= htmlspecialchars($v('patient_identifier'), ENT_QUOTES, 'UTF-8') ?>" required
            class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
      <?php endif; ?>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Tipo</label>
          <input name="tipo" value="<?= htmlspecialchars($v('tipo'), ENT_QUOTES, 'UTF-8') ?>" placeholder="urgencia/pqr/reporte_tecnico" required
            class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Prioridad (1-3)</label>
          <input name="prioridad" value="<?= htmlspecialchars($v('prioridad'), ENT_QUOTES, 'UTF-8') ?>" required
            class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Estado</label>
          <input name="estado" value="<?= htmlspecialchars($v('estado'), ENT_QUOTES, 'UTF-8') ?>" required
            class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700">Asunto</label>
        <input name="asunto" value="<?= htmlspecialchars($v('asunto'), ENT_QUOTES, 'UTF-8') ?>" required
          class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700">Mensaje</label>
        <textarea name="mensaje" rows="5" required
          class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"><?= htmlspecialchars($v('mensaje'), ENT_QUOTES, 'UTF-8') ?></textarea>
      </div>

      <div class="flex items-center justify-end gap-3">
        <a href="/interactions" class="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-gray-800">Cancelar</a>
        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <?= $isEdit ? 'Guardar cambios' : 'Crear interacción' ?>
        </button>
      </div>
    </form>
  </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';
