<?php

declare(strict_types=1);

$title = 'Portal Doctores - SADI';
ob_start();

$icon = static function (string $name, string $class): string {
  $common = 'class="' . htmlspecialchars($class, ENT_QUOTES, 'UTF-8') . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  if ($name === 'mail') return '<svg ' . $common . '><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 5L2 7"/></svg>';
  if ($name === 'lock') return '<svg ' . $common . '><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  if ($name === 'alert-circle') return '<svg ' . $common . '><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
  if ($name === 'arrow-left') return '<svg ' . $common . '><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>';
  return '';
};

$errorMsg = !empty($error) ? (string)$error : '';
$csrfToken = (string)($csrf ?? '');
?>
<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
  <div class="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
    <div class="mb-6">
      <a href="/login" class="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <?= $icon('arrow-left', 'h-4 w-4 mr-2') ?> Volver
      </a>
    </div>

    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Portal Doctores</h1>
      <p class="text-gray-600 mt-2">Accede con tus credenciales</p>
    </div>

    <?php if ($errorMsg !== '') : ?>
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <?= $icon('alert-circle', 'h-5 w-5 text-red-600 mt-0.5') ?>
        <p class="text-sm text-red-700"><?= htmlspecialchars($errorMsg, ENT_QUOTES, 'UTF-8') ?></p>
      </div>
    <?php endif; ?>

    <form method="post" action="/doctor/login" class="space-y-5">
      <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />

      <div>
        <label for="doctor-email" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Correo</label>
        <div class="relative mt-1">
          <?= $icon('mail', 'absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400') ?>
          <input
            id="doctor-email"
            name="email"
            type="email"
            class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="doctor1@sadi.com.co"
            required
          />
        </div>
      </div>

      <div>
        <label for="doctor-password" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Contraseña</label>
        <div class="relative mt-1">
          <?= $icon('lock', 'absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400') ?>
          <input
            id="doctor-password"
            name="password"
            type="password"
            class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="passwordstaff01"
            required
          />
        </div>
      </div>

      <button
        type="submit"
        class="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Ingresar
      </button>
    </form>

    <div class="mt-6 text-center text-sm text-gray-600">
      <a href="/patient/login" class="text-blue-600 hover:text-blue-700">Ir al portal de pacientes</a>
    </div>
  </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';
