<?php

declare(strict_types=1);

use App\Support\Auth\Auth;
use App\Support\Security\Csrf;

$title = $title ?? 'SADI';
$isAuthed = Auth::check();
$user = Auth::user() ?? [];
$role = Auth::role() ?? '';
$email = is_array($user) ? (string)($user['email'] ?? '') : '';
$name = is_array($user) ? (string)($user['name'] ?? '') : '';
$uri = (string)($_SERVER['REQUEST_URI'] ?? '/');
$csrf = Csrf::token();
$pageTitle = trim((string)preg_replace('/\s+-\s+SADI\s*$/', '', (string)$title));
$cssFile = __DIR__ . '/../../../public/assets/react/index-8f98e09b.css';
$cssVersion = is_file($cssFile) ? (string)filemtime($cssFile) : (string)time();

$navItems = [];
if ($role === 'hospital_admin') {
    $navItems = [
        ['href' => '/dashboard', 'label' => 'Dashboard', 'icon' => 'layout-dashboard'],
        ['href' => '/patients', 'label' => 'Pacientes', 'icon' => 'users'],
        ['href' => '/doctors', 'label' => 'Doctores', 'icon' => 'stethoscope'],
        ['href' => '/segmentation', 'label' => 'Segmentación', 'icon' => 'target'],
        ['href' => '/templates', 'label' => 'Plantillas SMS', 'icon' => 'file-text'],
        ['href' => '/campaigns', 'label' => 'Campañas', 'icon' => 'send'],
        ['href' => '/interactions', 'label' => 'Interacciones', 'icon' => 'message-square'],
        ['href' => '/reports', 'label' => 'Reportes', 'icon' => 'bar-chart-3'],
    ];
} elseif ($role === 'doctor') {
    $navItems = [
        ['href' => '/doctor/dashboard', 'label' => 'Dashboard', 'icon' => 'layout-dashboard'],
    ];
} elseif ($role === 'patient') {
    $navItems = [
        ['href' => '/patient/dashboard', 'label' => 'Dashboard', 'icon' => 'layout-dashboard'],
        ['href' => '/patient/schedule', 'label' => 'Mi Cronograma', 'icon' => 'calendar-days'],
        ['href' => '/patient/programs', 'label' => 'Mis Programas', 'icon' => 'activity'],
        ['href' => '/patient/history', 'label' => 'Historia Clínica', 'icon' => 'file-text'],
        ['href' => '/patient/health', 'label' => 'Mi Salud', 'icon' => 'heart'],
        ['href' => '/patient/interactions', 'label' => 'Interacciones', 'icon' => 'message-square'],
    ];
}

$isActive = static function (string $href) use ($uri): bool {
    if ($href === '/') return $uri === '/';
    if ($uri === $href) return true;
    return str_starts_with($uri, rtrim($href, '/') . '/');
};

$icon = static function (string $name, string $class = 'h-5 w-5 shrink-0'): string {
    $common = 'class="' . htmlspecialchars($class, ENT_QUOTES, 'UTF-8') . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    if ($name === 'layout-dashboard') {
        return '<svg ' . $common . '><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>';
    }
    if ($name === 'users') {
        return '<svg ' . $common . '><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    }
    if ($name === 'stethoscope') {
        return '<svg ' . $common . '><path d="M6 2v6a6 6 0 0 0 12 0V2"/><path d="M12 14v5a3 3 0 0 0 6 0v-1"/><circle cx="20" cy="18" r="2"/></svg>';
    }
    if ($name === 'calendar-days') {
        return '<svg ' . $common . '><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>';
    }
    if ($name === 'activity') {
        return '<svg ' . $common . '><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
    }
    if ($name === 'heart') {
        return '<svg ' . $common . '><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3.2.8-4.5 2.1C10.7 3.8 9.26 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
    }
    if ($name === 'alert-octagon') {
        return '<svg ' . $common . '><path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
    }
    if ($name === 'target') {
        return '<svg ' . $common . '><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
    }
    if ($name === 'file-text') {
        return '<svg ' . $common . '><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>';
    }
    if ($name === 'send') {
        return '<svg ' . $common . '><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9z"/></svg>';
    }
    if ($name === 'message-square') {
        return '<svg ' . $common . '><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>';
    }
    if ($name === 'bar-chart-3') {
        return '<svg ' . $common . '><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>';
    }
    if ($name === 'log-out') {
        return '<svg ' . $common . '><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';
    }
    if ($name === 'building-2') {
        return '<svg ' . $common . '><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M6 12h4"/><path d="M14 12h4"/><path d="M6 16h4"/><path d="M14 16h4"/><path d="M10 22V8h4v14"/></svg>';
    }
    return '';
};

$initials = static function (string $source): string {
    $source = trim($source);
    $parts = preg_split('/\s+/', $source) ?: [];
    $parts = array_values(array_filter($parts, static fn ($p) => $p !== ''));
    if (count($parts) === 0) return 'U';
    $first = strtoupper((string)substr((string)$parts[0], 0, 1));
    $second = '';
    if (count($parts) > 1) {
        $second = strtoupper((string)substr((string)$parts[1], 0, 1));
    } else {
        $second = strtoupper((string)substr((string)$parts[0], 1, 1));
    }
    $out = ($first . $second);
    return $out !== '' ? $out : 'U';
};

$headerTitle = static function (array $navItems, string $default) use ($isActive): string {
    foreach ($navItems as $item) {
        $href = $item['href'] ?? null;
        if (!is_string($href) || $href === '') continue;
        if ($isActive($href)) return (string)($item['label'] ?? $default);
    }
    return $default;
};

$hospitalName = is_array($user) ? (string)($user['hospital_name'] ?? '') : '';
$hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
$displayName = $name !== '' ? $name : ($email !== '' ? $email : 'Usuario');
$displayHospital = $hospitalName !== '' ? $hospitalName : 'Panel';
$currentTitle = $headerTitle($navItems, $pageTitle !== '' ? $pageTitle : 'SADI');
?>
<!doctype html>
<html lang="es-CO">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title><?= htmlspecialchars((string)$title, ENT_QUOTES, 'UTF-8') ?></title>
    <link rel="icon" type="image/png" href="/assets/react/SADI_logo-14ff2fa6.png" />
    <link rel="stylesheet" href="/assets/react/index-8f98e09b.css?v=<?= htmlspecialchars($cssVersion, ENT_QUOTES, 'UTF-8') ?>" />
  </head>
  <body>
    <?php if (!$isAuthed) : ?>
      <?= $content ?? '' ?>
    <?php else : ?>
      <?php if ($role === 'patient') : ?>
        <div class="min-h-screen bg-teal-50 overflow-x-hidden">
          <aside class="hidden lg:block fixed left-0 top-0 h-full w-72 bg-white border-r border-teal-200 shadow-sm z-40">
            <div class="flex h-full flex-col">
              <div class="p-6 bg-gradient-to-br from-teal-700 to-teal-600 flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h1 class="text-2xl font-bold text-white">SADI Salud</h1>
                  <p class="text-xs text-teal-100 mt-1">Portal del Paciente</p>
                </div>
              </div>

              <nav class="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
                <?php foreach ($navItems as $item) : ?>
                  <?php
                  $href = $item['href'] ?? null;
                  $label = (string)($item['label'] ?? '');
                  $ic = (string)($item['icon'] ?? '');
                  $enabled = is_string($href) && $href !== '';
                  $active = $enabled ? $isActive($href) : false;
                  ?>
                  <?php if ($enabled) : ?>
                    <a
                      href="<?= htmlspecialchars((string)$href, ENT_QUOTES, 'UTF-8') ?>"
                      class="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 <?= $active ? 'bg-teal-50 text-teal-800 font-semibold ring-1 ring-teal-100' : 'text-gray-700 hover:bg-teal-50' ?>"
                    >
                      <?= $icon($ic) ?>
                      <span class="min-w-0 truncate"><?= htmlspecialchars($label, ENT_QUOTES, 'UTF-8') ?></span>
                    </a>
                  <?php else : ?>
                    <div class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-400">
                      <?= $icon($ic) ?>
                      <span class="min-w-0 truncate"><?= htmlspecialchars($label, ENT_QUOTES, 'UTF-8') ?></span>
                    </div>
                  <?php endif; ?>
                <?php endforeach; ?>

                <button
                  type="button"
                  class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-red-700 hover:bg-red-50 font-semibold"
                  data-patient-sos
                >
                  <?= $icon('alert-octagon') ?>
                  <span class="min-w-0 truncate">SOS</span>
                </button>
              </nav>

              <div class="p-4 border-t border-gray-200">
                <div class="mb-3 px-4">
                  <p class="text-sm font-medium text-gray-900 truncate"><?= htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8') ?></p>
                  <p class="text-xs text-gray-500">Paciente</p>
                </div>
                <form method="post" action="/logout">
                  <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>" />
                  <button type="submit" class="w-full inline-flex items-center justify-start rounded-xl border border-red-100 bg-background hover:bg-red-50 hover:text-red-700 h-10 px-4 py-2 text-sm font-medium">
                    <?= $icon('log-out', 'h-4 w-4 mr-2') ?>
                    Cerrar Sesión
                  </button>
                </form>
              </div>
            </div>
          </aside>

          <aside id="patientMobileSidebar" class="fixed left-0 top-0 h-full w-72 bg-white border-r border-teal-200 shadow-lg z-40 lg:hidden -translate-x-full transition-transform duration-200">
            <div class="flex h-full flex-col">
              <div class="p-6 bg-gradient-to-br from-teal-700 to-teal-600 flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h1 class="text-2xl font-bold text-white">SADI Salud</h1>
                  <p class="text-xs text-teal-100 mt-1">Portal del Paciente</p>
                </div>
                <button type="button" id="patientSidebarClose" class="inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 h-10 w-10" aria-label="Cerrar menú">
                  <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <nav class="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
                <?php foreach ($navItems as $item) : ?>
                  <?php
                  $href = $item['href'] ?? null;
                  $label = (string)($item['label'] ?? '');
                  $ic = (string)($item['icon'] ?? '');
                  $enabled = is_string($href) && $href !== '';
                  $active = $enabled ? $isActive($href) : false;
                  ?>
                  <?php if ($enabled) : ?>
                    <a
                      href="<?= htmlspecialchars((string)$href, ENT_QUOTES, 'UTF-8') ?>"
                      class="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 <?= $active ? 'bg-teal-50 text-teal-800 font-semibold ring-1 ring-teal-100' : 'text-gray-700 hover:bg-teal-50' ?>"
                      data-patient-nav
                    >
                      <?= $icon($ic) ?>
                      <span class="min-w-0 truncate"><?= htmlspecialchars($label, ENT_QUOTES, 'UTF-8') ?></span>
                    </a>
                  <?php endif; ?>
                <?php endforeach; ?>

                <button
                  type="button"
                  class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-red-700 hover:bg-red-50 font-semibold"
                  data-patient-sos
                >
                  <?= $icon('alert-octagon') ?>
                  <span class="min-w-0 truncate">SOS</span>
                </button>
              </nav>

              <div class="p-4 border-t border-gray-200">
                <div class="mb-3 px-4">
                  <p class="text-sm font-medium text-gray-900 truncate"><?= htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8') ?></p>
                  <p class="text-xs text-gray-500">Paciente</p>
                </div>
                <form method="post" action="/logout">
                  <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>" />
                  <button type="submit" class="w-full inline-flex items-center justify-start rounded-xl border border-red-100 bg-background hover:bg-red-50 hover:text-red-700 h-10 px-4 py-2 text-sm font-medium">
                    <?= $icon('log-out', 'h-4 w-4 mr-2') ?>
                    Cerrar Sesión
                  </button>
                </form>
              </div>
            </div>
          </aside>

          <main class="lg:ml-72 min-h-screen min-w-0">
            <header class="sticky top-0 z-30 border-b border-teal-100 bg-white/80 backdrop-blur">
              <div class="flex items-center justify-between px-4 py-3 lg:px-8">
                <div class="flex items-center gap-3 min-w-0">
                  <button type="button" id="patientSidebarOpen" class="inline-flex items-center justify-center rounded-xl border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10 lg:hidden" aria-label="Abrir menú">
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
                  </button>
                  <div class="min-w-0">
                    <p class="text-xs text-gray-500 truncate">Portal del paciente</p>
                    <h2 class="text-base font-semibold text-gray-900 truncate"><?= htmlspecialchars($currentTitle !== '' ? $currentTitle : 'SADI Salud', ENT_QUOTES, 'UTF-8') ?></h2>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <div class="hidden sm:block text-right leading-tight">
                    <p class="text-sm font-medium text-gray-900 truncate max-w-[240px]"><?= htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8') ?></p>
                    <p class="text-xs text-gray-500">Paciente</p>
                  </div>
                  <div class="h-9 w-9 rounded-xl bg-gradient-to-br from-teal-700 to-teal-500 text-white flex items-center justify-center text-sm font-semibold">
                    <?= htmlspecialchars($initials($displayName), ENT_QUOTES, 'UTF-8') ?>
                  </div>
                  <form method="post" action="/logout">
                    <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>" />
                    <button type="submit" class="inline-flex items-center justify-center rounded-xl border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10" aria-label="Cerrar sesión">
                      <?= $icon('log-out', 'h-4 w-4') ?>
                    </button>
                  </form>
                </div>
              </div>
            </header>

            <div class="p-4 lg:p-8 min-w-0 max-w-full">
              <?= $content ?? '' ?>
            </div>
          </main>

          <div id="patientSidebarOverlay" class="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden hidden"></div>
        </div>
        <script>
          (function () {
            var openBtn = document.getElementById('patientSidebarOpen');
            var closeBtn = document.getElementById('patientSidebarClose');
            var sidebar = document.getElementById('patientMobileSidebar');
            var overlay = document.getElementById('patientSidebarOverlay');
            if (!sidebar || !overlay) return;

            function open() {
              sidebar.classList.remove('-translate-x-full');
              overlay.classList.remove('hidden');
            }

            function close() {
              sidebar.classList.add('-translate-x-full');
              overlay.classList.add('hidden');
            }

            if (openBtn) openBtn.addEventListener('click', open);
            if (closeBtn) closeBtn.addEventListener('click', close);
            overlay.addEventListener('click', close);

            document.querySelectorAll('[data-patient-nav]').forEach(function (a) {
              a.addEventListener('click', close);
            });

            document.querySelectorAll('[data-patient-sos]').forEach(function (btn) {
              btn.addEventListener('click', function () {
                alert('El botón SOS no está habilitado para tu EPS/IPS actualmente.');
              });
            });
          })();
        </script>
      <?php else : ?>
      <div class="min-h-screen bg-gray-50 overflow-x-hidden">
        <aside class="hidden lg:block fixed left-0 top-0 h-full w-72 bg-white border-r border-gray-200 shadow-sm z-40">
          <div class="flex h-full flex-col">
            <div class="p-6 flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h1 class="text-2xl font-bold text-blue-600">SADI</h1>
                <p class="text-xs text-gray-500 mt-1">Sistema de Apoyo para Demanda Inducida</p>
                <?php if ($hospitalId !== '') : ?>
                  <div class="mt-2 px-2 py-1 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-center gap-1">
                    <?= $icon('building-2', 'h-3 w-3') ?>
                    <span class="truncate max-w-[160px]"><?= htmlspecialchars($displayHospital !== '' ? $displayHospital : 'Hospital', ENT_QUOTES, 'UTF-8') ?></span>
                  </div>
                <?php endif; ?>
              </div>
            </div>

            <nav class="px-3 pb-4 space-y-1 flex-1 overflow-y-auto">
              <?php foreach ($navItems as $item) : ?>
                <?php
                $href = $item['href'] ?? null;
                $label = (string)($item['label'] ?? '');
                $ic = (string)($item['icon'] ?? '');
                $enabled = is_string($href) && $href !== '';
                $active = $enabled ? $isActive($href) : false;
                ?>
                <?php if ($enabled) : ?>
                  <a
                    href="<?= htmlspecialchars((string)$href, ENT_QUOTES, 'UTF-8') ?>"
                    class="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 <?= $active ? 'bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-100' : 'text-gray-700 hover:bg-gray-50' ?>"
                  >
                    <?= $icon($ic) ?>
                    <span class="min-w-0 truncate"><?= htmlspecialchars($label, ENT_QUOTES, 'UTF-8') ?></span>
                  </a>
                <?php else : ?>
                  <div class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-400">
                    <?= $icon($ic) ?>
                    <span class="min-w-0 truncate"><?= htmlspecialchars($label, ENT_QUOTES, 'UTF-8') ?></span>
                  </div>
                <?php endif; ?>
              <?php endforeach; ?>
            </nav>

            <div class="p-4 border-t border-gray-200">
              <div class="mb-3 px-4">
                <p class="text-sm font-medium text-gray-900 truncate"><?= htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8') ?></p>
                <p class="text-xs text-gray-500 capitalize"><?= htmlspecialchars(str_replace('_', ' ', $role), ENT_QUOTES, 'UTF-8') ?></p>
              </div>
              <form method="post" action="/logout">
                <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>" />
                <button type="submit" class="w-full inline-flex items-center justify-start rounded-xl border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-sm font-medium">
                  <?= $icon('log-out', 'h-4 w-4 mr-2') ?>
                  Cerrar Sesión
                </button>
              </form>
            </div>
          </div>
        </aside>

        <main class="lg:ml-72 min-h-screen min-w-0">
          <header class="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur">
            <div class="flex items-center justify-between px-4 py-3 lg:px-8">
              <div class="flex items-center gap-3 min-w-0">
                <div class="min-w-0">
                  <p class="text-xs text-gray-500 truncate"><?= htmlspecialchars($displayHospital !== '' ? $displayHospital : 'Panel', ENT_QUOTES, 'UTF-8') ?></p>
                  <h2 class="text-base font-semibold text-gray-900 truncate"><?= htmlspecialchars($currentTitle, ENT_QUOTES, 'UTF-8') ?></h2>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <div class="hidden sm:block text-right leading-tight">
                  <p class="text-sm font-medium text-gray-900 truncate max-w-[240px]"><?= htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8') ?></p>
                  <p class="text-xs text-gray-500 capitalize"><?= htmlspecialchars(str_replace('_', ' ', $role), ENT_QUOTES, 'UTF-8') ?></p>
                </div>
                <div class="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold">
                  <?= htmlspecialchars($initials($displayName), ENT_QUOTES, 'UTF-8') ?>
                </div>
                <form method="post" action="/logout">
                  <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>" />
                  <button type="submit" class="inline-flex items-center justify-center rounded-xl border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10" aria-label="Cerrar sesión">
                    <?= $icon('log-out', 'h-4 w-4') ?>
                  </button>
                </form>
              </div>
            </div>
          </header>

          <div class="p-4 lg:p-8 min-w-0 max-w-full">
            <?= $content ?? '' ?>
          </div>
        </main>
      </div>
      <?php endif; ?>
    <?php endif; ?>
  </body>
</html>
