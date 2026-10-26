<?php

declare(strict_types=1);

$title = 'Interacciones - SADI';
ob_start();

$patientData = (isset($patientData) && is_array($patientData)) ? $patientData : null;
$rows = (isset($rows) && is_array($rows)) ? $rows : [];
$csrfToken = isset($csrf) ? (string)$csrf : '';
$errorMsg = isset($error) ? (string)$error : '';
$successMsg = isset($success) ? (string)$success : '';

$icon = static function (string $name, string $class = 'h-5 w-5'): string {
  $c = 'class="' . htmlspecialchars($class, ENT_QUOTES, 'UTF-8') . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  if ($name === 'message') return '<svg ' . $c . '><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>';
  if ($name === 'plus') return '<svg ' . $c . '><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
  return '';
};

$badge = static function (string $estado): array {
  $e = strtolower(trim($estado));
  if ($e === 'resuelto' || $e === 'cerrado') return ['bg-green-100 text-green-800', 'Resuelto'];
  if ($e === 'en_proceso' || $e === 'en proceso') return ['bg-blue-100 text-blue-800', 'En proceso'];
  if ($e === 'pendiente') return ['bg-yellow-100 text-yellow-800', 'Pendiente'];
  return ['bg-gray-100 text-gray-800', $estado !== '' ? $estado : 'Sin estado'];
};

$fmtDate = static function (?string $ts): string {
  $ts = $ts !== null ? trim($ts) : '';
  if ($ts === '') return '';
  try {
    return (new DateTimeImmutable($ts))->format('d/m/Y');
  } catch (Throwable $e) {
    return '';
  }
};
?>

<div class="max-w-4xl mx-auto space-y-6">
  <div class="flex items-center gap-3">
    <div class="bg-teal-50 p-3 rounded-full">
      <?= $icon('message', 'h-6 w-6 text-teal-600') ?>
    </div>
    <div class="min-w-0">
      <h1 class="text-2xl font-bold text-gray-900">Interacciones</h1>
      <p class="text-gray-500 text-sm">Envía solicitudes y consulta respuestas del hospital</p>
    </div>
  </div>

  <?php if ($successMsg !== '') : ?>
    <div class="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-lg">
      <p class="text-sm text-emerald-800"><?= htmlspecialchars($successMsg, ENT_QUOTES, 'UTF-8') ?></p>
    </div>
  <?php endif; ?>

  <?php if ($errorMsg !== '') : ?>
    <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
      <p class="text-sm text-red-800"><?= htmlspecialchars($errorMsg, ENT_QUOTES, 'UTF-8') ?></p>
    </div>
  <?php endif; ?>

  <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <h2 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">
      <?= $icon('plus', 'h-5 w-5 text-teal-600') ?>
      Nueva solicitud
    </h2>
    <form method="post" action="/patient/interactions" class="space-y-4">
      <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>" />
      <div>
        <label for="tipo" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Tipo</label>
        <select id="tipo" name="tipo" class="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent">
          <option value="">Selecciona un tipo...</option>
          <option value="PQRS">PQRS</option>
          <option value="Cita">Cita</option>
          <option value="Resultados">Resultados</option>
          <option value="Otro">Otro</option>
        </select>
      </div>
      <div>
        <label for="asunto" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Asunto</label>
        <input id="asunto" name="asunto" type="text" class="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Escribe el asunto..." />
      </div>
      <div>
        <label for="mensaje" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Mensaje</label>
        <textarea id="mensaje" name="mensaje" rows="5" class="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Describe tu solicitud..."></textarea>
      </div>
      <div class="flex justify-end">
        <button type="submit" class="inline-flex items-center justify-center rounded-md bg-teal-600 hover:bg-teal-700 text-white h-10 px-4 py-2 text-sm font-medium">Enviar</button>
      </div>
    </form>
  </div>

  <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-100">
      <h2 class="font-semibold text-gray-900">Mis solicitudes</h2>
    </div>

    <?php if (!$patientData) : ?>
      <div class="p-6">
        <p class="text-gray-600">No se encontró tu perfil de paciente.</p>
      </div>
    <?php elseif (count($rows) === 0) : ?>
      <div class="p-6">
        <p class="text-gray-600">Aún no has enviado solicitudes.</p>
      </div>
    <?php else : ?>
      <?php foreach ($rows as $idx => $r) : ?>
        <?php
        $estado = (string)($r['estado'] ?? '');
        [$badgeClass, $badgeLabel] = $badge($estado);
        $created = $fmtDate((string)($r['created_at'] ?? ''));
        ?>
        <div class="p-6 <?= $idx !== count($rows) - 1 ? 'border-b border-gray-100' : '' ?>">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-xs px-2 py-1 rounded-full <?= htmlspecialchars($badgeClass, ENT_QUOTES, 'UTF-8') ?>">
                  <?= htmlspecialchars($badgeLabel, ENT_QUOTES, 'UTF-8') ?>
                </span>
                <span class="text-xs text-gray-400"><?= htmlspecialchars($created, ENT_QUOTES, 'UTF-8') ?></span>
              </div>
              <p class="mt-2 font-semibold text-gray-900 break-words"><?= htmlspecialchars((string)($r['asunto'] ?? ''), ENT_QUOTES, 'UTF-8') ?></p>
              <p class="text-sm text-gray-500 mt-1">Tipo: <?= htmlspecialchars((string)($r['tipo'] ?? ''), ENT_QUOTES, 'UTF-8') ?></p>
              <p class="text-sm text-gray-700 mt-3 whitespace-pre-wrap break-words"><?= htmlspecialchars((string)($r['mensaje'] ?? ''), ENT_QUOTES, 'UTF-8') ?></p>
            </div>
          </div>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </div>
</div>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';
