<?php

declare(strict_types=1);

$title = 'Login - SADI';
ob_start();

$icon = static function (string $name, string $class): string {
  $common = 'class="' . htmlspecialchars($class, ENT_QUOTES, 'UTF-8') . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  if ($name === 'mail') return '<svg ' . $common . '><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 5L2 7"/></svg>';
  if ($name === 'lock') return '<svg ' . $common . '><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  if ($name === 'alert-circle') return '<svg ' . $common . '><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
  return '';
};

$errorMsg = !empty($error) ? (string)$error : '';
$successMsg = !empty($success) ? (string)$success : '';
$csrfToken = (string)($csrf ?? '');
?>
<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
  <div class="w-full max-w-md">
    <div class="bg-white rounded-2xl shadow-2xl p-8">
      <div class="text-center mb-8">
        <div class="flex justify-center mb-4">
          <img src="/assets/react/SADI_logo.jpg" alt="SADI Logo" class="h-20 w-auto" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900">Portal Administrativo</h1>
        <p class="text-sm text-gray-500 mt-2">Sistema de Apoyo para Demanda Inducida</p>
      </div>

      <?php if ($errorMsg !== '') : ?>
        <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div class="flex items-start gap-3">
            <?= $icon('alert-circle', 'h-5 w-5 text-red-600 flex-shrink-0 mt-0.5') ?>
            <p class="text-sm text-red-800"><?= htmlspecialchars($errorMsg, ENT_QUOTES, 'UTF-8') ?></p>
          </div>
        </div>
      <?php endif; ?>

      <?php if ($successMsg !== '') : ?>
        <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-start gap-3">
            <div class="h-5 w-5 mt-0.5 flex-shrink-0 rounded-full bg-green-600"></div>
            <p class="text-sm text-green-800"><?= htmlspecialchars($successMsg, ENT_QUOTES, 'UTF-8') ?></p>
          </div>
        </div>
      <?php endif; ?>

      <form method="post" action="/login" class="space-y-6">
        <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />

        <div>
          <label for="email" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Correo Institucional</label>
          <div class="relative mt-2">
            <?= $icon('mail', 'absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400') ?>
            <input
              id="email"
              name="email"
              type="email"
              class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="admin@hospital.com"
              required
            />
          </div>
          <p class="text-xs text-gray-500 mt-1">Solo correos institucionales de EPS/IPS</p>
        </div>

        <div>
          <div class="flex justify-between items-center mb-2">
            <label for="password" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Contraseña</label>
            <a href="/login?mode=forgot" class="text-xs text-blue-600 hover:underline">¿Olvidó su contraseña?</a>
          </div>
          <div class="relative">
            <?= $icon('lock', 'absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400') ?>
            <input
              id="password"
              name="password"
              type="password"
              class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          class="w-full py-3 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Ingresar al Portal Admin
        </button>
      </form>

      <div class="mt-6 space-y-3">
        <a
          href="mailto:info.apropiatic@gmail.com?subject=Problema%20de%20acceso%20-%20Staff%2FHospital"
          class="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900 mx-auto"
        >
          <?= $icon('alert-circle', 'h-4 w-4') ?>
          ¿Problemas para iniciar sesión?
        </a>

        <div class="border-t pt-3 text-center space-y-2">
          <a href="/patient/login" class="block text-sm text-blue-600 hover:underline">¿Es paciente? Ingrese aquí</a>
          <a href="/doctor/login" class="block text-sm text-blue-600 hover:underline">¿Es doctor? Ingrese aquí</a>
          <a href="/register-hospital" class="block text-sm text-blue-600 hover:underline">¿Hospital nuevo? Regístrese aquí</a>
        </div>
      </div>

      <div class="mt-6 p-4 bg-blue-50 rounded-lg text-xs text-gray-600 space-y-1">
        <p class="font-bold">Información de Ubicación:</p>
        <p>Colombia | Cali, Valle del Cauca</p>
        <p>Carrera 1, Calle 19N | Oficina 01B</p>
        <p>Torre de Cali | Piso 23</p>
      </div>
    </div>
  </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';
