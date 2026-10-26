<?php

declare(strict_types=1);

$title = 'Mi Cronograma - SADI';
ob_start();
?>

<div class="max-w-4xl mx-auto">
  <h1 class="text-2xl font-bold text-gray-900 mb-6">Mi Cronograma</h1>
  <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
    <p class="text-gray-700">Esta sección se encuentra disponible en la versión original (React) con agenda y reserva de citas.</p>
    <p class="text-gray-500 mt-2">En SSR se mantiene la navegación y el diseño base del portal del paciente, mientras se completa la paridad funcional.</p>
  </div>
</div>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/app.php';

