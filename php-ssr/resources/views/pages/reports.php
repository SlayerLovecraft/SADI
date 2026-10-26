<?php

declare(strict_types=1);

$title = 'Reportes - SADI';
$stats = (isset($stats) && is_array($stats)) ? $stats : [];
$deliveryRate = isset($deliveryRate) ? (float)$deliveryRate : 0.0;

$totalPatients = (int)($stats['total_patients'] ?? 0);
$activeCampaigns = (int)($stats['active_campaigns'] ?? 0);
$totalInteractions = (int)($stats['total_interactions'] ?? 0);

ob_start();
?>
<div class="max-w-6xl mx-auto space-y-6">
  <div>
    <h1 class="text-3xl font-bold text-gray-900">Reportes</h1>
    <p class="text-gray-500 mt-1">Resumen y exportación de datos del hospital.</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <div class="bg-white rounded-xl shadow-md p-6">
      <p class="text-sm text-gray-500">Total Pacientes</p>
      <p class="text-3xl font-bold text-gray-900 mt-2"><?= $totalPatients ?></p>
      <p class="text-xs text-gray-500 mt-2">Registrados en el sistema</p>
    </div>
    <div class="bg-white rounded-xl shadow-md p-6">
      <p class="text-sm text-gray-500">Campañas Activas</p>
      <p class="text-3xl font-bold text-gray-900 mt-2"><?= $activeCampaigns ?></p>
      <p class="text-xs text-gray-500 mt-2">En envío o en proceso</p>
    </div>
    <div class="bg-white rounded-xl shadow-md p-6">
      <p class="text-sm text-gray-500">Interacciones</p>
      <p class="text-3xl font-bold text-gray-900 mt-2"><?= $totalInteractions ?></p>
      <p class="text-xs text-gray-500 mt-2">Total de mensajes</p>
    </div>
    <div class="bg-white rounded-xl shadow-md p-6">
      <p class="text-sm text-gray-500">Tasa de Entrega</p>
      <p class="text-3xl font-bold text-gray-900 mt-2"><?= number_format($deliveryRate, 1) ?>%</p>
      <p class="text-xs text-gray-500 mt-2">Entregados / destinatarios</p>
    </div>
  </div>

  <div class="bg-white rounded-xl shadow-md p-6">
    <h2 class="text-lg font-semibold text-gray-900">Exportar</h2>
    <p class="text-sm text-gray-500 mt-1">Descarga reportes en CSV (compatible con Excel).</p>
    <div class="flex flex-wrap gap-3 mt-4">
      <a class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors" href="/reports/export/patients">Exportar Pacientes</a>
      <a class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors" href="/reports/export/campaigns">Exportar Campañas</a>
      <a class="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors" href="/reports/export/interactions">Exportar Interacciones</a>
    </div>
  </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';

