<?php

declare(strict_types=1);

$title = 'Dashboard - SADI';
ob_start();
$user = (isset($user) && is_array($user)) ? $user : [];
$stats = (isset($stats) && is_array($stats)) ? $stats : [
  'total_patients' => 0,
  'active_campaigns' => 0,
  'delivery_rate' => 0,
  'total_interactions' => 0,
];
$recentCampaigns = (isset($recentCampaigns) && is_array($recentCampaigns)) ? $recentCampaigns : [];
$recentInteractions = (isset($recentInteractions) && is_array($recentInteractions)) ? $recentInteractions : [];
$campaignStatus = (isset($stats['campaign_status']) && is_array($stats['campaign_status'])) ? $stats['campaign_status'] : ['en_progreso' => 0, 'completadas' => 0, 'programadas' => 0, 'total' => 0];
$demographics = (isset($stats['demographics']) && is_array($stats['demographics'])) ? $stats['demographics'] : ['hombres' => 0, 'mujeres' => 0, 'ninos' => 0, 'ninas' => 0, 'total' => 0];

$icon = static function (string $name, string $class): string {
  $common = 'class="' . htmlspecialchars($class, ENT_QUOTES, 'UTF-8') . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  if ($name === 'users') {
    return '<svg ' . $common . '><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  }
  if ($name === 'send') {
    return '<svg ' . $common . '><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9z"/></svg>';
  }
  if ($name === 'trending-up') {
    return '<svg ' . $common . '><path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>';
  }
  if ($name === 'message-square') {
    return '<svg ' . $common . '><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>';
  }
  if ($name === 'activity') {
    return '<svg ' . $common . '><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
  }
  return '';
};

$timeAgo = static function (?string $timestamp): string {
  if ($timestamp === null || trim($timestamp) === '') return 'Hace menos de 1 minuto';
  try {
    $dt = new DateTimeImmutable($timestamp);
  } catch (Throwable $e) {
    return 'Hace menos de 1 minuto';
  }
  $seconds = max(0, time() - $dt->getTimestamp());
  if ($seconds < 60) return 'Hace menos de 1 minuto';
  if ($seconds < 3600) return 'Hace ' . (int)floor($seconds / 60) . ' minuto(s)';
  if ($seconds < 86400) return 'Hace ' . (int)floor($seconds / 3600) . ' hora(s)';
  return 'Hace ' . (int)floor($seconds / 86400) . ' día(s)';
};

$kpiCards = [
  [
    'title' => 'Total Pacientes',
    'value' => (string)((int)($stats['total_patients'] ?? 0)),
    'icon' => 'users',
    'color' => 'bg-blue-500',
    'subtitle' => 'Registrados en el sistema',
  ],
  [
    'title' => 'Campañas Pendientes',
    'value' => (string)((int)($stats['active_campaigns'] ?? 0)),
    'icon' => 'send',
    'color' => 'bg-green-500',
    'subtitle' => 'Por enviar o en proceso',
  ],
  [
    'title' => 'Tasa de Entrega',
    'value' => htmlspecialchars((string)($stats['delivery_rate'] ?? 0), ENT_QUOTES, 'UTF-8') . '%',
    'icon' => 'trending-up',
    'color' => 'bg-purple-500',
    'subtitle' => 'Mensajes entregados',
  ],
  [
    'title' => 'Interacciones',
    'value' => (string)((int)($stats['total_interactions'] ?? 0)),
    'icon' => 'message-square',
    'color' => 'bg-orange-500',
    'subtitle' => 'Total de mensajes',
  ],
];

$recentActivity = [];
foreach (array_slice($recentCampaigns, 0, 2) as $c) {
  $name = (string)($c['nombre'] ?? $c['name'] ?? '');
  $status = strtolower((string)($c['estado'] ?? $c['status'] ?? ''));
  $recentActivity[] = [
    'message' => 'Campaña "' . $name . '" ' . ($status !== '' ? $status : 'activa'),
    'time' => $timeAgo(isset($c['created_at']) ? (string)$c['created_at'] : (isset($c['fecha_creacion']) ? (string)$c['fecha_creacion'] : null)),
    'color' => 'bg-blue-500',
  ];
}
foreach (array_slice($recentInteractions, 0, 2) as $i) {
  $estado = strtolower((string)($i['estado'] ?? $i['status'] ?? ''));
  $recentActivity[] = [
    'message' => 'Mensaje ' . ($estado !== '' ? $estado : 'pendiente'),
    'time' => $timeAgo(isset($i['created_at']) ? (string)$i['created_at'] : (isset($i['fecha_creacion']) ? (string)$i['fecha_creacion'] : null)),
    'color' => ($estado === 'entregado' || $estado === 'delivered') ? 'bg-green-500' : 'bg-yellow-500',
  ];
}

$campaignTotal = (int)($campaignStatus['en_progreso'] ?? 0) + (int)($campaignStatus['completadas'] ?? 0) + (int)($campaignStatus['programadas'] ?? 0);
$demoTotal = (int)($demographics['hombres'] ?? 0) + (int)($demographics['mujeres'] ?? 0) + (int)($demographics['ninos'] ?? 0) + (int)($demographics['ninas'] ?? 0);
?>
<div class="space-y-6">
  <div>
    <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
    <p class="text-gray-500 mt-1">Vista general del sistema - Datos en tiempo real desde Supabase</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <?php foreach ($kpiCards as $kpi) : ?>
      <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 mb-1"><?= htmlspecialchars((string)$kpi['title'], ENT_QUOTES, 'UTF-8') ?></p>
            <p class="text-3xl font-bold text-gray-900"><?= htmlspecialchars((string)$kpi['value'], ENT_QUOTES, 'UTF-8') ?></p>
            <p class="text-xs text-gray-500 mt-2"><?= htmlspecialchars((string)$kpi['subtitle'], ENT_QUOTES, 'UTF-8') ?></p>
          </div>
          <div class="<?= htmlspecialchars((string)$kpi['color'], ENT_QUOTES, 'UTF-8') ?> p-4 rounded-lg">
            <?= $icon((string)$kpi['icon'], 'h-8 w-8 text-white') ?>
          </div>
        </div>
      </div>
    <?php endforeach; ?>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="bg-white rounded-xl shadow-md p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Actividad Reciente</h2>
      <div class="space-y-4">
        <?php if (count($recentActivity) > 0) : ?>
          <?php foreach (array_slice($recentActivity, 0, 4) as $item) : ?>
            <div class="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
              <div class="w-2 h-2 <?= htmlspecialchars((string)$item['color'], ENT_QUOTES, 'UTF-8') ?> rounded-full"></div>
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-900"><?= htmlspecialchars((string)$item['message'], ENT_QUOTES, 'UTF-8') ?></p>
                <p class="text-xs text-gray-500"><?= htmlspecialchars((string)$item['time'], ENT_QUOTES, 'UTF-8') ?></p>
              </div>
            </div>
          <?php endforeach; ?>
        <?php else : ?>
          <div class="text-center py-8 text-gray-400">
            <?= $icon('activity', 'h-12 w-12 mx-auto mb-2 opacity-50') ?>
            <p class="text-sm">No hay actividad reciente</p>
          </div>
        <?php endif; ?>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-md p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Estadísticas de Campañas</h2>

      <div class="space-y-4">
        <div>
          <h3 class="text-sm font-semibold text-gray-700 mb-3">Estado de Campañas</h3>
          <div class="space-y-3">
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm text-gray-600">En Progreso</span>
                <span class="text-sm font-bold text-blue-600"><?= (int)($campaignStatus['en_progreso'] ?? 0) ?></span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-3">
                <div class="bg-blue-500 h-3 rounded-full transition-all duration-500" style="width:<?= htmlspecialchars((string)($campaignTotal > 0 ? (($campaignStatus['en_progreso'] ?? 0) / $campaignTotal) * 100 : 0), ENT_QUOTES, 'UTF-8') ?>%"></div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm text-gray-600">Completadas</span>
                <span class="text-sm font-bold text-green-600"><?= (int)($campaignStatus['completadas'] ?? 0) ?></span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-3">
                <div class="bg-green-500 h-3 rounded-full transition-all duration-500" style="width:<?= htmlspecialchars((string)($campaignTotal > 0 ? (($campaignStatus['completadas'] ?? 0) / $campaignTotal) * 100 : 0), ENT_QUOTES, 'UTF-8') ?>%"></div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm text-gray-600">Programadas</span>
                <span class="text-sm font-bold text-yellow-600"><?= (int)($campaignStatus['programadas'] ?? 0) ?></span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-3">
                <div class="bg-yellow-500 h-3 rounded-full transition-all duration-500" style="width:<?= htmlspecialchars((string)($campaignTotal > 0 ? (($campaignStatus['programadas'] ?? 0) / $campaignTotal) * 100 : 0), ENT_QUOTES, 'UTF-8') ?>%"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">Participantes por Demografía</h3>
          <div class="space-y-3">
            <?php
            $demoRows = [
              ['label' => '👨 Hombres', 'value' => (int)($demographics['hombres'] ?? 0), 'color' => 'bg-indigo-500'],
              ['label' => '👩 Mujeres', 'value' => (int)($demographics['mujeres'] ?? 0), 'color' => 'bg-pink-500'],
              ['label' => '👦 Niños', 'value' => (int)($demographics['ninos'] ?? 0), 'color' => 'bg-cyan-500'],
              ['label' => '👧 Niñas', 'value' => (int)($demographics['ninas'] ?? 0), 'color' => 'bg-purple-500'],
            ];
            ?>
            <?php foreach ($demoRows as $demo) : ?>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm text-gray-600"><?= htmlspecialchars((string)$demo['label'], ENT_QUOTES, 'UTF-8') ?></span>
                  <span class="text-sm font-bold text-gray-900"><?= (int)$demo['value'] ?></span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-3">
                  <div class="<?= htmlspecialchars((string)$demo['color'], ENT_QUOTES, 'UTF-8') ?> h-3 rounded-full transition-all duration-500" style="width:<?= htmlspecialchars((string)($demoTotal > 0 ? (($demo['value'] ?? 0) / $demoTotal) * 100 : 0), ENT_QUOTES, 'UTF-8') ?>%"></div>
                </div>
              </div>
            <?php endforeach; ?>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="text-center text-sm text-gray-500">
    <p>Última actualización: <?= htmlspecialchars((new DateTimeImmutable('now'))->format('H:i:s'), ENT_QUOTES, 'UTF-8') ?></p>
    <p class="mt-1">Hospital ID: <?= htmlspecialchars((string)($user['hospital_id'] ?? 'No identificado'), ENT_QUOTES, 'UTF-8') ?> | Conectado a Supabase</p>
  </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';
