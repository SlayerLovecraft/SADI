<?php

declare(strict_types=1);

$title = 'Mis Programas - SADI';
ob_start();

$patientData = (isset($patientData) && is_array($patientData)) ? $patientData : null;
$programs = (isset($programs) && is_array($programs)) ? $programs : [];
$programsError = isset($programsError) ? (string)$programsError : '';

$icon = static function (string $name, string $class = 'h-5 w-5'): string {
  $c = 'class="' . htmlspecialchars($class, ENT_QUOTES, 'UTF-8') . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  if ($name === 'activity') return '<svg ' . $c . '><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
  if ($name === 'alert-triangle') return '<svg ' . $c . '><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
  if ($name === 'calendar') return '<svg ' . $c . '><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';
  return '';
};

$programsForUI = [];
if (count($programs) > 0) {
  foreach ($programs as $p) {
    $programsForUI[] = [
      'id' => (string)($p['id'] ?? ''),
      'name' => (string)($p['program_name'] ?? 'Programa'),
      'doctor' => (string)($p['doctor_name'] ?? 'Sin especialista'),
      'nextCheck' => $p['next_check_date'] ?? null,
      'status' => (string)($p['status'] ?? 'Activo'),
    ];
  }
} elseif ($patientData && trim((string)($patientData['program'] ?? '')) !== '') {
  $programsForUI[] = [
    'id' => (string)($patientData['patient_id'] ?? ''),
    'name' => (string)($patientData['program'] ?? ''),
    'doctor' => 'Sin especialista',
    'nextCheck' => null,
    'status' => 'Activo',
  ];
}
?>

<div class="max-w-4xl mx-auto">
  <h1 class="text-2xl font-bold text-gray-900 mb-6">Mis Programas de Salud</h1>

  <?php if (!$patientData || $programsError !== '') : ?>
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
      <div class="flex items-start gap-3">
        <?= $icon('alert-triangle', 'h-6 w-6 text-red-600 mt-0.5') ?>
        <div>
          <h2 class="font-semibold text-gray-900">No se pudieron cargar tus programas</h2>
          <p class="text-sm text-gray-600 mt-1"><?= htmlspecialchars($programsError !== '' ? $programsError : 'No se encontró el perfil del paciente', ENT_QUOTES, 'UTF-8') ?></p>
        </div>
      </div>
    </div>
  <?php elseif (count($programsForUI) === 0) : ?>
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
      <p class="text-gray-600">Aún no tienes programas asignados.</p>
    </div>
  <?php else : ?>
    <div class="space-y-4">
      <?php foreach ($programsForUI as $program) : ?>
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
          <div class="flex items-center space-x-4">
            <div class="bg-teal-50 p-3 rounded-full">
              <?= $icon('activity', 'h-6 w-6 text-teal-600') ?>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900"><?= htmlspecialchars((string)$program['name'], ENT_QUOTES, 'UTF-8') ?></h3>
              <p class="text-sm text-gray-500">Especialista: <?= htmlspecialchars((string)$program['doctor'], ENT_QUOTES, 'UTF-8') ?></p>
            </div>
          </div>
          <div class="text-right">
            <div class="flex items-center text-sm text-orange-600 mb-1 justify-end">
              <?= $icon('calendar', 'h-4 w-4 mr-1') ?>
              <?php if (!empty($program['nextCheck'])) : ?>
                <?php
                $label = '';
                try {
                  $label = (new DateTimeImmutable((string)$program['nextCheck']))->format('d/m/Y');
                } catch (Throwable $e) {
                  $label = '';
                }
                ?>
                Próxima cita: <?= htmlspecialchars($label !== '' ? $label : 'Sin cita programada', ENT_QUOTES, 'UTF-8') ?>
              <?php else : ?>
                Sin cita programada
              <?php endif; ?>
            </div>
            <span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              <?= htmlspecialchars((string)$program['status'], ENT_QUOTES, 'UTF-8') ?>
            </span>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</div>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';
