<?php

declare(strict_types=1);

$title = 'Mi Salud - Registro Diario';
ob_start();

$patientData = is_array($patientData ?? null) ? $patientData : null;
$patientError = (string)($patientError ?? '');
$csrfToken = (string)($csrf ?? '');
$errorMsg = (string)($error ?? '');
$successMsg = (string)($success ?? '');

$icon = static function (string $name, string $class = 'h-5 w-5'): string {
  $c = 'class="' . htmlspecialchars($class, ENT_QUOTES, 'UTF-8') . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  if ($name === 'heart') return '<svg ' . $c . '><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3.2.8-4.5 2.1C10.7 3.8 9.26 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  if ($name === 'alert-triangle') return '<svg ' . $c . '><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
  if ($name === 'loader') return '<svg ' . $c . '><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v9h-9"/></svg>';
  return '';
};
?>

<?php if ($patientError !== '' || !$patientData) : ?>
  <div class="flex items-center justify-center h-screen">
    <div class="text-center max-w-md">
      <div class="mx-auto mb-4 h-16 w-16 text-red-500">
        <?= $icon('alert-triangle', 'h-16 w-16') ?>
      </div>
      <h2 class="text-xl font-semibold mb-2">Error</h2>
      <p class="text-gray-600 mb-4"><?= htmlspecialchars($patientError !== '' ? $patientError : 'No se encontraron tus datos', ENT_QUOTES, 'UTF-8') ?></p>
      <a href="/patient/dashboard" class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Volver al Dashboard</a>
    </div>
  </div>
<?php else : ?>
  <div class="max-w-2xl mx-auto">
    <div class="text-center mb-8">
      <div class="inline-flex p-3 bg-red-100 rounded-full mb-4">
        <?= $icon('heart', 'h-8 w-8 text-red-600') ?>
      </div>
      <h1 class="text-2xl font-bold text-gray-900">Registro Diario de Salud</h1>
      <p class="text-gray-500">Registra tus signos vitales para un mejor seguimiento</p>
    </div>

    <?php if ($successMsg !== '') : ?>
      <div class="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded mb-6">
        <p class="text-sm text-emerald-800"><?= htmlspecialchars($successMsg, ENT_QUOTES, 'UTF-8') ?></p>
      </div>
    <?php endif; ?>

    <?php if ($errorMsg !== '') : ?>
      <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-6">
        <p class="text-sm text-red-800"><?= htmlspecialchars($errorMsg, ENT_QUOTES, 'UTF-8') ?></p>
      </div>
    <?php endif; ?>

    <form method="post" action="/patient/health" class="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6">
      <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label for="temperatura" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Temperatura (°C)</label>
          <input id="temperatura" name="temperatura" type="number" step="0.1" class="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Ej: 36.5" min="30" max="45" />
          <p class="text-xs text-gray-500 mt-1">Rango normal: 36.0 - 37.5°C</p>
        </div>

        <div>
          <label for="ritmo_cardiaco" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Ritmo Cardíaco (bpm)</label>
          <input id="ritmo_cardiaco" name="ritmo_cardiaco" type="number" class="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Ej: 72" min="40" max="200" />
          <p class="text-xs text-gray-500 mt-1">Rango normal: 60 - 100 bpm</p>
        </div>

        <div>
          <label for="presion_sistolica" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Presión Sistólica (mmHg)</label>
          <input id="presion_sistolica" name="presion_sistolica" type="number" class="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Ej: 120" min="60" max="250" />
          <p class="text-xs text-gray-500 mt-1">Número superior</p>
        </div>

        <div>
          <label for="presion_diastolica" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Presión Diastólica (mmHg)</label>
          <input id="presion_diastolica" name="presion_diastolica" type="number" class="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Ej: 80" min="40" max="150" />
          <p class="text-xs text-gray-500 mt-1">Número inferior</p>
        </div>

        <div>
          <label for="glucometria" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Glucometría (mg/dL)</label>
          <input id="glucometria" name="glucometria" type="number" class="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Ej: 90" min="40" max="500" />
          <p class="text-xs text-gray-500 mt-1">Rango normal: 70 - 140 mg/dL</p>
        </div>

        <div>
          <label for="peso" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Peso (kg)</label>
          <input id="peso" name="peso" type="number" step="0.1" class="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Ej: 70.5" min="20" max="300" />
          <p class="text-xs text-gray-500 mt-1">Opcional</p>
        </div>
      </div>

      <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p class="text-sm text-blue-800"><strong>Importante:</strong> Puedes registrar solo un dato; los demás se mantienen</p>
      </div>

      <div class="flex gap-4">
        <a href="/patient/dashboard" class="flex-1 inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-sm font-medium">Cancelar</a>
        <button type="submit" class="flex-1 inline-flex items-center justify-center rounded-md bg-teal-600 hover:bg-teal-700 text-white h-10 px-4 py-2 text-sm font-medium">Guardar</button>
      </div>
    </form>
  </div>
<?php endif; ?>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';

