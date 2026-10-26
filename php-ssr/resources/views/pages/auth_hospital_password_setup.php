<?php

declare(strict_types=1);

$title = 'Configurar contraseña - SADI';
$error = $error ?? null;
$success = $success ?? null;
$csrf = $csrf ?? '';
$token = $token ?? '';
ob_start();
?>
<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
  <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Configurar contraseña</h1>
      <p class="text-sm text-gray-500 mt-2">Portal Administrativo</p>
    </div>

    <?php if (!empty($error)) : ?>
      <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
        <?= htmlspecialchars((string)$error, ENT_QUOTES, 'UTF-8') ?>
      </div>
    <?php endif; ?>

    <?php if (!empty($success)) : ?>
      <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
        <?= htmlspecialchars((string)$success, ENT_QUOTES, 'UTF-8') ?>
      </div>
    <?php endif; ?>

    <form method="post" action="/setup/hospital-password" class="space-y-6">
      <input type="hidden" name="_csrf" value="<?= htmlspecialchars((string)$csrf, ENT_QUOTES, 'UTF-8') ?>" />
      <?php if (is_string($token) && $token !== '') : ?>
        <input type="hidden" name="token" value="<?= htmlspecialchars((string)$token, ENT_QUOTES, 'UTF-8') ?>" />
      <?php endif; ?>

      <div>
        <label for="email" class="block text-sm font-medium text-gray-700">Correo Institucional</label>
        <input id="email" name="email" type="email" required
          class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-gray-700">Nueva contraseña</label>
        <input id="password" name="password" type="password" required
          class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      <div>
        <label for="confirm_password" class="block text-sm font-medium text-gray-700">Confirmar contraseña</label>
        <input id="confirm_password" name="confirm_password" type="password" required
          class="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      <button type="submit"
        class="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors">
        Guardar
      </button>
    </form>

    <div class="mt-6 text-sm text-center">
      <a href="/login" class="text-gray-600 hover:text-gray-900">Volver al login</a>
    </div>
  </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';

