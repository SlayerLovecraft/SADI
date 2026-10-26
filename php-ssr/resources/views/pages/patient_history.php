<?php

declare(strict_types=1);

$title = 'Historia Clínica - SADI';
ob_start();

$patientData = (isset($patientData) && is_array($patientData)) ? $patientData : null;
$history = (isset($history) && is_array($history)) ? $history : [];
$historyError = isset($historyError) ? (string)$historyError : '';

$icon = static function (string $name, string $class = 'h-5 w-5'): string {
  $c = 'class="' . htmlspecialchars($class, ENT_QUOTES, 'UTF-8') . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  if ($name === 'alert-triangle') return '<svg ' . $c . '><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
  if ($name === 'file-text') return '<svg ' . $c . '><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>';
  if ($name === 'download') return '<svg ' . $c . '><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>';
  return '';
};
?>

<div class="max-w-4xl mx-auto">
  <h1 class="text-2xl font-bold text-gray-900 mb-6">Historia Clínica</h1>

  <?php if (!$patientData || $historyError !== '') : ?>
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
      <div class="flex items-start gap-3">
        <?= $icon('alert-triangle', 'h-6 w-6 text-red-600 mt-0.5') ?>
        <div>
          <h2 class="font-semibold text-gray-900">No se pudo cargar tu historia clínica</h2>
          <p class="text-sm text-gray-600 mt-1"><?= htmlspecialchars($historyError !== '' ? $historyError : 'No se encontró el perfil del paciente', ENT_QUOTES, 'UTF-8') ?></p>
        </div>
      </div>
    </div>
  <?php elseif (count($history) === 0) : ?>
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
      <p class="text-gray-600">Aún no hay registros en tu historia clínica.</p>
    </div>
  <?php else : ?>
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <?php foreach ($history as $i => $item) : ?>
        <?php
        $id = (string)($item['id'] ?? '');
        $type = (string)($item['record_type'] ?? 'Registro clínico');
        $doctor = (string)($item['doctor_name'] ?? '');
        $notes = (string)($item['notes'] ?? '');
        $dateLabel = '';
        $rd = trim((string)($item['record_date'] ?? ''));
        if ($rd !== '') {
          try {
            $dateLabel = (new DateTimeImmutable($rd))->format('d/m/Y');
          } catch (Throwable $e) {
            $dateLabel = '';
          }
        }
        ?>
        <div class="p-6 <?= $i !== count($history) - 1 ? 'border-b border-gray-100' : '' ?>">
          <div class="flex justify-between items-start gap-4">
            <div class="flex items-start space-x-4 min-w-0">
              <div class="mt-1">
                <?= $icon('file-text', 'h-5 w-5 text-gray-400') ?>
              </div>
              <div class="min-w-0">
                <h3 class="font-semibold text-gray-900"><?= htmlspecialchars($type, ENT_QUOTES, 'UTF-8') ?></h3>
                <p class="text-sm text-gray-500 mb-2">
                  <?= htmlspecialchars($dateLabel, ENT_QUOTES, 'UTF-8') ?>
                  <?= $doctor !== '' ? htmlspecialchars(' - ' . $doctor, ENT_QUOTES, 'UTF-8') : '' ?>
                </p>
                <p class="text-gray-700 text-sm break-words"><?= htmlspecialchars($notes, ENT_QUOTES, 'UTF-8') ?></p>
              </div>
            </div>
            <a
              href="<?= htmlspecialchars($id !== '' ? '/patient/history/' . rawurlencode($id) . '/download' : '#', ENT_QUOTES, 'UTF-8') ?>"
              class="inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 text-sm font-medium <?= ($id === '' || $notes === '') ? 'pointer-events-none opacity-50' : '' ?>"
            >
              <?= $icon('download', 'h-4 w-4 mr-2') ?> Descargar
            </a>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</div>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';
