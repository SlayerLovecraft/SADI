<?php

declare(strict_types=1);

$title = 'Mi Salud - Dashboard';
ob_start();

$patientData = (isset($patientData) && is_array($patientData)) ? $patientData : null;
$patientError = isset($patientError) ? (string)$patientError : '';
$healthStatus = (isset($healthStatus) && is_array($healthStatus)) ? $healthStatus : ['status' => 'Sin datos', 'alerts' => []];
$alerts = (isset($healthStatus['alerts']) && is_array($healthStatus['alerts'])) ? $healthStatus['alerts'] : [];
$status = isset($healthStatus['status']) ? (string)$healthStatus['status'] : 'Sin datos';
$hasAlerts = isset($hasAlerts) ? (bool)$hasAlerts : false;
$hasNoData = isset($hasNoData) ? (bool)$hasNoData : false;
$latestDateLabel = isset($latestDateLabel) ? (string)$latestDateLabel : 'Sin registros';
$firstName = isset($firstName) ? (string)$firstName : '';
$metrics = (isset($metrics) && is_array($metrics)) ? $metrics : [];
$monthlyAverage = (isset($monthlyAverage) && is_array($monthlyAverage)) ? $monthlyAverage : null;
$successMsg = isset($success) ? (string)$success : '';
$errorMsg = isset($error) ? (string)$error : '';

$icon = static function (string $name, string $class = 'h-5 w-5'): string {
  $c = 'class="' . htmlspecialchars($class, ENT_QUOTES, 'UTF-8') . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  if ($name === 'activity') return '<svg ' . $c . '><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
  if ($name === 'heart') return '<svg ' . $c . '><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3.2.8-4.5 2.1C10.7 3.8 9.26 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  if ($name === 'user') return '<svg ' . $c . '><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  if ($name === 'calendar') return '<svg ' . $c . '><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';
  if ($name === 'map-pin') return '<svg ' . $c . '><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
  if ($name === 'alert-triangle') return '<svg ' . $c . '><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
  if ($name === 'plus') return '<svg ' . $c . '><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
  if ($name === 'refresh') return '<svg ' . $c . '><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9"/><path d="M21 3v9h-9"/></svg>';
  if ($name === 'heart-pulse') return '<svg ' . $c . '><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3.2.8-4.5 2.1C10.7 3.8 9.26 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3 13h3l2-5 3 9 2-5h6"/></svg>';
  if ($name === 'thermometer') return '<svg ' . $c . '><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4 4 0 1 0 5 0Z"/></svg>';
  if ($name === 'gauge') return '<svg ' . $c . '><path d="M12 20a8 8 0 1 0-8-8"/><path d="M12 12l4-2"/><path d="M4 12h1"/><path d="M19 12h1"/></svg>';
  if ($name === 'droplet') return '<svg ' . $c . '><path d="M12 2.69 7 8a7 7 0 0 0 10 9.5A7 7 0 0 0 17 8Z"/></svg>';
  return '';
};

$calculateAge = static function (?string $birthdate): ?int {
  $birthdate = $birthdate !== null ? trim($birthdate) : '';
  if ($birthdate === '') return null;
  try {
    $birth = new DateTimeImmutable($birthdate);
  } catch (Throwable $e) {
    return null;
  }
  $today = new DateTimeImmutable('today');
  $diff = $today->diff($birth);
  return is_object($diff) ? (int)$diff->y : null;
};

$fmtNum = static function (float $n, int $decimals = 0): string {
  if ($decimals <= 0) return (string)((int)round($n));
  $s = number_format($n, $decimals, '.', '');
  $s = rtrim(rtrim($s, '0'), '.');
  return $s === '' ? '0' : $s;
};
?>
<?php if ($patientError !== '' || !$patientData) : ?>
  <div class="flex items-center justify-center h-screen">
    <div class="text-center max-w-md">
      <div class="mx-auto mb-4 h-16 w-16 text-red-500">
        <?= $icon('alert-triangle', 'h-16 w-16') ?>
      </div>
      <h2 class="text-xl font-semibold mb-2">No se encontró tu perfil</h2>
      <p class="text-gray-600 mb-4"><?= htmlspecialchars($patientError !== '' ? $patientError : 'Error desconocido', ENT_QUOTES, 'UTF-8') ?></p>
      <div class="flex gap-3 justify-center">
        <a href="/patient/login" class="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cerrar sesión</a>
        <a href="/patient/dashboard" class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2">
          <?= $icon('refresh', 'h-4 w-4') ?>
          Reintentar
        </a>
      </div>
    </div>
  </div>
<?php else : ?>
  <div class="max-w-5xl mx-auto space-y-6">
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

    <div class="<?= $hasAlerts ? 'bg-gradient-to-r from-red-600 to-red-800' : 'bg-gradient-to-r from-teal-600 to-teal-800' ?> rounded-2xl p-8 text-white shadow-lg">
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-3xl font-bold">Hola, <?= htmlspecialchars($firstName !== '' ? $firstName : (string)($patientData['name'] ?? ''), ENT_QUOTES, 'UTF-8') ?></h1>
          <p class="<?= $hasAlerts ? 'text-red-100' : 'text-teal-100' ?> mt-2">
            <?= htmlspecialchars($hasAlerts ? '⚠️ Alertas de salud detectadas' : 'Bienvenido a tu portal de salud', ENT_QUOTES, 'UTF-8') ?>
          </p>
        </div>
        <a href="/patient/dashboard" class="p-2 rounded-lg <?= $hasAlerts ? 'bg-red-700 hover:bg-red-600' : 'bg-teal-700 hover:bg-teal-600' ?>" aria-label="Refrescar">
          <?= $icon('refresh', 'h-5 w-5') ?>
        </a>
      </div>
    </div>

    <?php if ($hasNoData) : ?>
      <div class="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg">
        <div class="flex items-start justify-between">
          <div class="flex items-start">
            <?= $icon('alert-triangle', 'h-5 w-5 text-blue-500 mr-3 mt-0.5') ?>
            <div>
              <h3 class="font-semibold text-blue-800">Registra tus signos vitales</h3>
              <p class="text-sm text-blue-700 mt-1">Comienza a monitorear tu salud</p>
            </div>
          </div>
          <a href="/patient/health" class="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <?= $icon('plus', 'h-4 w-4') ?>
            Registrar
          </a>
        </div>
      </div>
    <?php endif; ?>

    <?php if ($hasAlerts) : ?>
      <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
        <div class="flex items-start">
          <?= $icon('alert-triangle', 'h-5 w-5 text-red-500 mr-3 mt-0.5') ?>
          <div>
            <h3 class="font-semibold text-red-800">Alertas de Salud</h3>
            <ul class="mt-2 space-y-1">
              <?php foreach ($alerts as $a) : ?>
                <li class="text-sm text-red-700">• <?= htmlspecialchars((string)$a, ENT_QUOTES, 'UTF-8') ?></li>
              <?php endforeach; ?>
            </ul>
          </div>
        </div>
      </div>
    <?php endif; ?>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white p-6 rounded-xl shadow-sm border">
        <div class="flex items-center space-x-4 mb-6">
          <div class="<?= $hasAlerts ? 'bg-red-100' : 'bg-teal-100' ?> p-3 rounded-full">
            <?= $icon('user', 'h-6 w-6 ' . ($hasAlerts ? 'text-red-700' : 'text-teal-700')) ?>
          </div>
          <div>
            <h3 class="font-semibold">Mis Datos</h3>
            <span class="text-xs px-2 py-1 rounded-full <?= $status === 'Saludable' ? 'bg-green-100 text-green-700' : ($status === 'Sin datos' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700') ?>">
              <?= htmlspecialchars($status, ENT_QUOTES, 'UTF-8') ?>
            </span>
          </div>
        </div>
        <div class="space-y-3 text-sm text-gray-600">
          <div class="flex items-center">
            <?= $icon('calendar', 'h-4 w-4 mr-2') ?>
            <?= htmlspecialchars((string)($calculateAge((string)($patientData['birthdate'] ?? '')) ?? '--'), ENT_QUOTES, 'UTF-8') ?> Años
          </div>
          <div class="flex items-center">
            <?= $icon('map-pin', 'h-4 w-4 mr-2') ?>
            <?= htmlspecialchars((string)($patientData['address'] ?? 'No especificada'), ENT_QUOTES, 'UTF-8') ?>
          </div>
          <div class="flex items-center">
            <?= $icon('activity', 'h-4 w-4 mr-2') ?>
            <?= htmlspecialchars((string)($patientData['program'] ?? 'No asignado'), ENT_QUOTES, 'UTF-8') ?>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-xl shadow-sm border md:col-span-2">
        <div class="flex items-center justify-between mb-6">
          <h3 class="font-semibold flex items-center">
            <?= $icon('heart', 'h-5 w-5 text-red-500 mr-2') ?>
            Últimos Signos Vitales
          </h3>
          <span class="text-xs text-gray-400"><?= htmlspecialchars($latestDateLabel, ENT_QUOTES, 'UTF-8') ?></span>
        </div>

        <?php
        $hr = (int)($metrics['hr'] ?? 0);
        $sys = (int)($metrics['sys'] ?? 0);
        $dia = (int)($metrics['dia'] ?? 0);
        $temp = (float)($metrics['temp'] ?? 0);
        $gluc = (int)($metrics['gluc'] ?? 0);
        $hrLabel = (string)($metrics['hrLabel'] ?? 'Sin datos');
        $bpLabel = (string)($metrics['bpLabel'] ?? 'Sin datos');
        $tempLabel = (string)($metrics['tempLabel'] ?? 'Sin datos');
        $glucLabel = (string)($metrics['glucLabel'] ?? 'Sin datos');
        $bpNeedleDeg = (float)($metrics['bpNeedleDeg'] ?? -70);
        $tempFillPct = (float)($metrics['tempFillPct'] ?? 0);
        $glucFillPct = (float)($metrics['glucFillPct'] ?? 0);
        ?>

        <div class="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="relative min-h-[140px] overflow-hidden rounded-xl border border-pink-100 bg-gradient-to-br from-pink-50 via-white to-pink-100/60 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs text-gray-500">Ritmo Cardíaco</p>
                <div class="mt-1 flex items-end gap-2">
                  <p class="text-xl font-bold text-pink-700 tabular-nums">
                    <?= htmlspecialchars((string)$hr, ENT_QUOTES, 'UTF-8') ?> <span class="text-sm font-semibold text-pink-500">bpm</span>
                  </p>
                  <span class="text-[11px] px-2 py-0.5 rounded-full border <?= $hrLabel === 'Normal' ? 'bg-green-50 text-green-700 border-green-200' : ($hrLabel === 'Sin datos' ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-red-50 text-red-700 border-red-200') ?>">
                    <?= htmlspecialchars($hrLabel, ENT_QUOTES, 'UTF-8') ?>
                  </span>
                </div>
              </div>

              <div class="relative overflow-hidden rounded-full">
                <div class="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-pink-200">
                  <?= $icon('heart-pulse', 'h-5 w-5 text-pink-600') ?>
                </div>
              </div>
            </div>

            <div class="mt-3 flex items-end gap-1">
              <?php for ($i = 0; $i < 18; $i++) : ?>
                <?php $base = 20 + (($i * 37) % 55); ?>
                <div class="w-1 rounded-full bg-pink-400/70" style="height: <?= (int)$base ?>%; opacity: <?= $hasNoData ? '0.35' : '0.9' ?>;"></div>
              <?php endfor; ?>
            </div>
          </div>

          <div class="relative min-h-[140px] overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-100/60 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs text-gray-500">Presión</p>
                <div class="mt-1 flex items-end gap-2">
                  <p class="text-xl font-bold text-blue-700 tabular-nums"><?= htmlspecialchars((string)$sys, ENT_QUOTES, 'UTF-8') ?>/<?= htmlspecialchars((string)$dia, ENT_QUOTES, 'UTF-8') ?></p>
                  <span class="text-[11px] px-2 py-0.5 rounded-full border <?= $bpLabel === 'Normal' ? 'bg-green-50 text-green-700 border-green-200' : ($bpLabel === 'Sin datos' ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-red-50 text-red-700 border-red-200') ?>">
                    <?= htmlspecialchars($bpLabel, ENT_QUOTES, 'UTF-8') ?>
                  </span>
                </div>
              </div>

              <div class="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-blue-200">
                <?= $icon('gauge', 'h-5 w-5 text-blue-600') ?>
              </div>
            </div>

            <div class="mt-3 flex items-center justify-between gap-3">
              <div class="relative h-10 w-20">
                <div class="absolute inset-x-0 bottom-0 h-10 overflow-hidden rounded-t-full border border-blue-200 bg-white/70">
                  <div class="absolute inset-0" style="background: conic-gradient(from 180deg, rgba(34,197,94,0.45), rgba(59,130,246,0.45), rgba(239,68,68,0.45));"></div>
                  <div class="absolute inset-0 bg-white/55"></div>
                </div>
                <div class="absolute left-1/2 bottom-1 h-9 w-0.5 origin-bottom rounded-full bg-blue-700 shadow-sm" style="transform: translateX(-50%) rotate(<?= htmlspecialchars((string)$bpNeedleDeg, ENT_QUOTES, 'UTF-8') ?>deg)"></div>
                <div class="absolute left-1/2 bottom-0 h-2 w-2 -translate-x-1/2 rounded-full bg-blue-700"></div>
              </div>

              <div class="flex-1">
                <?php
                $sysPct = ($sys <= 0) ? 0 : max(0, min(100, (($sys - 70) / (180 - 70)) * 100));
                ?>
                <div class="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                  <div class="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" style="width: <?= htmlspecialchars((string)$sysPct, ENT_QUOTES, 'UTF-8') ?>%"></div>
                </div>
                <div class="mt-2 flex justify-between text-[11px] text-gray-500">
                  <span>70</span>
                  <span>180</span>
                </div>
              </div>
            </div>
          </div>

          <div class="relative min-h-[140px] overflow-hidden rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-100/60 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs text-gray-500">Temperatura</p>
                <div class="mt-1 flex items-end gap-2">
                  <p class="text-xl font-bold text-orange-700 tabular-nums">
                    <?= htmlspecialchars($fmtNum($temp, 1), ENT_QUOTES, 'UTF-8') ?> <span class="text-sm font-semibold text-orange-500">°C</span>
                  </p>
                  <span class="text-[11px] px-2 py-0.5 rounded-full border <?= $tempLabel === 'Normal' ? 'bg-green-50 text-green-700 border-green-200' : ($tempLabel === 'Sin datos' ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-red-50 text-red-700 border-red-200') ?>">
                    <?= htmlspecialchars($tempLabel, ENT_QUOTES, 'UTF-8') ?>
                  </span>
                </div>
              </div>

              <div class="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-orange-200">
                <?= $icon('thermometer', 'h-5 w-5 text-orange-600') ?>
              </div>
            </div>

            <div class="mt-3 flex items-end justify-between gap-3">
              <div class="relative h-14 w-7 overflow-hidden rounded-full border border-orange-200 bg-white/75 p-1">
                <div class="absolute bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-orange-500 shadow-sm"></div>
                <div class="absolute bottom-2 left-1/2 w-2 -translate-x-1/2 rounded-full bg-gradient-to-t from-orange-500 to-red-500" style="height: <?= htmlspecialchars((string)max(10, ($tempFillPct / 100) * 42), ENT_QUOTES, 'UTF-8') ?>px"></div>
              </div>

              <div class="flex-1">
                <div class="h-2 w-full overflow-hidden rounded-full bg-orange-100">
                  <div class="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" style="width: <?= htmlspecialchars((string)$tempFillPct, ENT_QUOTES, 'UTF-8') ?>%"></div>
                </div>
                <div class="mt-2 flex justify-between text-[11px] text-gray-500">
                  <span>34°</span>
                  <span>40°</span>
                </div>
              </div>
            </div>
          </div>

          <div class="relative min-h-[140px] overflow-hidden rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-fuchsia-100/60 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs text-gray-500">Glucometría</p>
                <div class="mt-1 flex items-end gap-2">
                  <p class="text-xl font-bold text-purple-700 tabular-nums">
                    <?= htmlspecialchars((string)$gluc, ENT_QUOTES, 'UTF-8') ?> <span class="text-sm font-semibold text-purple-500">mg/dL</span>
                  </p>
                  <span class="text-[11px] px-2 py-0.5 rounded-full border <?= $glucLabel === 'Normal' ? 'bg-green-50 text-green-700 border-green-200' : ($glucLabel === 'Sin datos' ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-red-50 text-red-700 border-red-200') ?>">
                    <?= htmlspecialchars($glucLabel, ENT_QUOTES, 'UTF-8') ?>
                  </span>
                </div>
              </div>

              <div class="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-purple-200">
                <?= $icon('droplet', 'h-5 w-5 text-purple-600') ?>
              </div>
            </div>

            <div class="mt-3 flex items-center gap-3">
              <div class="relative h-12 w-12 overflow-hidden rounded-full">
                <div class="absolute inset-0 rounded-full border border-purple-200 bg-white/70"></div>
                <div class="absolute inset-1 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500" style="clip-path: inset(<?= htmlspecialchars((string)(100 - $glucFillPct), ENT_QUOTES, 'UTF-8') ?>% 0 0 0 round 999px)"></div>
              </div>

              <div class="flex-1">
                <div class="h-2 w-full overflow-hidden rounded-full bg-purple-100">
                  <div class="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" style="width: <?= htmlspecialchars((string)$glucFillPct, ENT_QUOTES, 'UTF-8') ?>%"></div>
                </div>
                <div class="mt-2 flex justify-between text-[11px] text-gray-500">
                  <span>50</span>
                  <span>220</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <?php if ($monthlyAverage && !$hasNoData) : ?>
      <?php
      $avgHr = (int)($metrics['avgHr'] ?? 0);
      $avgSys = (int)($metrics['avgSys'] ?? 0);
      $avgDia = (int)($metrics['avgDia'] ?? 0);
      $avgTemp = (float)($metrics['avgTemp'] ?? 0);
      $avgGluc = (int)($metrics['avgGluc'] ?? 0);
      $avgBpNeedleDeg = (float)($metrics['avgBpNeedleDeg'] ?? -70);
      $avgTempFillPct = (float)($metrics['avgTempFillPct'] ?? 0);
      $avgGlucFillPct = (float)($metrics['avgGlucFillPct'] ?? 0);
      ?>
      <div class="bg-white p-6 rounded-xl shadow-sm border">
        <h3 class="font-semibold mb-6 flex items-center">
          <?= $icon('activity', 'h-5 w-5 text-teal-500 mr-2') ?>
          Promedio Mensual
        </h3>
        <div class="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="relative min-h-[120px] overflow-hidden rounded-xl border border-pink-100 bg-gradient-to-br from-pink-50 via-white to-pink-100/60 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs text-gray-500">Ritmo Cardíaco</p>
                <p class="mt-1 text-xl font-bold text-pink-700 tabular-nums"><?= htmlspecialchars((string)$avgHr, ENT_QUOTES, 'UTF-8') ?> <span class="text-sm font-semibold text-pink-500">bpm</span></p>
              </div>
              <div class="relative overflow-hidden rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-pink-200">
                <?= $icon('heart-pulse', 'h-5 w-5 text-pink-600') ?>
              </div>
            </div>
            <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-pink-100">
              <div class="h-full rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-red-500" style="width: <?= htmlspecialchars((string)max(0, min(100, ($avgHr / 140) * 100)), ENT_QUOTES, 'UTF-8') ?>%"></div>
            </div>
            <div class="mt-2 flex justify-between text-[11px] text-gray-500">
              <span>0</span>
              <span>140</span>
            </div>
          </div>

          <div class="relative min-h-[120px] overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-100/60 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs text-gray-500">Presión</p>
                <p class="mt-1 text-xl font-bold text-blue-700 tabular-nums"><?= htmlspecialchars((string)$avgSys, ENT_QUOTES, 'UTF-8') ?>/<?= htmlspecialchars((string)$avgDia, ENT_QUOTES, 'UTF-8') ?></p>
              </div>
              <div class="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-blue-200">
                <?= $icon('gauge', 'h-5 w-5 text-blue-600') ?>
              </div>
            </div>
            <div class="mt-3 flex items-center justify-between gap-3">
              <div class="relative h-10 w-20">
                <div class="absolute inset-x-0 bottom-0 h-10 overflow-hidden rounded-t-full border border-blue-200 bg-white/70">
                  <div class="absolute inset-0" style="background: conic-gradient(from 180deg, rgba(34,197,94,0.45), rgba(59,130,246,0.45), rgba(239,68,68,0.45));"></div>
                  <div class="absolute inset-0 bg-white/55"></div>
                </div>
                <div class="absolute left-1/2 bottom-1 h-9 w-0.5 origin-bottom rounded-full bg-blue-700 shadow-sm" style="transform: translateX(-50%) rotate(<?= htmlspecialchars((string)$avgBpNeedleDeg, ENT_QUOTES, 'UTF-8') ?>deg)"></div>
                <div class="absolute left-1/2 bottom-0 h-2 w-2 -translate-x-1/2 rounded-full bg-blue-700"></div>
              </div>
              <div class="flex-1">
                <?php
                $avgSysPct = ($avgSys <= 0) ? 0 : max(0, min(100, (($avgSys - 70) / (180 - 70)) * 100));
                ?>
                <div class="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                  <div class="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" style="width: <?= htmlspecialchars((string)$avgSysPct, ENT_QUOTES, 'UTF-8') ?>%"></div>
                </div>
                <div class="mt-2 flex justify-between text-[11px] text-gray-500">
                  <span>70</span>
                  <span>180</span>
                </div>
              </div>
            </div>
          </div>

          <div class="relative min-h-[120px] overflow-hidden rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-100/60 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs text-gray-500">Temperatura</p>
                <p class="mt-1 text-xl font-bold text-orange-700 tabular-nums"><?= htmlspecialchars($fmtNum($avgTemp, 1), ENT_QUOTES, 'UTF-8') ?> <span class="text-sm font-semibold text-orange-500">°C</span></p>
              </div>
              <div class="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-orange-200">
                <?= $icon('thermometer', 'h-5 w-5 text-orange-600') ?>
              </div>
            </div>
            <div class="mt-3 flex items-end justify-between gap-3">
              <div class="relative h-14 w-7 overflow-hidden rounded-full border border-orange-200 bg-white/75 p-1">
                <div class="absolute bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-orange-500 shadow-sm"></div>
                <div class="absolute bottom-2 left-1/2 w-2 -translate-x-1/2 rounded-full bg-gradient-to-t from-orange-500 to-red-500" style="height: <?= htmlspecialchars((string)max(10, ($avgTempFillPct / 100) * 42), ENT_QUOTES, 'UTF-8') ?>px"></div>
              </div>
              <div class="flex-1">
                <div class="h-2 w-full overflow-hidden rounded-full bg-orange-100">
                  <div class="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" style="width: <?= htmlspecialchars((string)$avgTempFillPct, ENT_QUOTES, 'UTF-8') ?>%"></div>
                </div>
                <div class="mt-2 flex justify-between text-[11px] text-gray-500">
                  <span>34°</span>
                  <span>40°</span>
                </div>
              </div>
            </div>
          </div>

          <div class="relative min-h-[120px] overflow-hidden rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-fuchsia-100/60 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs text-gray-500">Glucometría</p>
                <p class="mt-1 text-xl font-bold text-purple-700 tabular-nums"><?= htmlspecialchars((string)$avgGluc, ENT_QUOTES, 'UTF-8') ?> <span class="text-sm font-semibold text-purple-500">mg/dL</span></p>
              </div>
              <div class="relative rounded-full bg-white/80 p-2 shadow-sm ring-1 ring-purple-200">
                <?= $icon('droplet', 'h-5 w-5 text-purple-600') ?>
              </div>
            </div>
            <div class="mt-3 flex items-center gap-3">
              <div class="relative h-12 w-12 overflow-hidden rounded-full">
                <div class="absolute inset-0 rounded-full border border-purple-200 bg-white/70"></div>
                <div class="absolute inset-1 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500" style="clip-path: inset(<?= htmlspecialchars((string)(100 - $avgGlucFillPct), ENT_QUOTES, 'UTF-8') ?>% 0 0 0 round 999px)"></div>
              </div>
              <div class="flex-1">
                <div class="h-2 w-full overflow-hidden rounded-full bg-purple-100">
                  <div class="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" style="width: <?= htmlspecialchars((string)$avgGlucFillPct, ENT_QUOTES, 'UTF-8') ?>%"></div>
                </div>
                <div class="mt-2 flex justify-between text-[11px] text-gray-500">
                  <span>50</span>
                  <span>220</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    <?php endif; ?>
  </div>
<?php endif; ?>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';
