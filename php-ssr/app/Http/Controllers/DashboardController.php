<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Infrastructure\Db;
use App\Repositories\PatientsRepository;
use App\Support\Auth\Auth;
use App\Support\Http\Request;
use App\Support\Http\Response;
use App\Support\Security\Csrf;
use App\Support\Session\Session;
use App\View\View;
use App\Repositories\DashboardRepository;
use DateInterval;
use DateTimeImmutable;
use Throwable;

final class DashboardController
{
    public function index(Request $request, Db $db, View $view, array $config): Response
    {
        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $repo = new DashboardRepository($db, (int)($config['app']['dashboard_cache_ttl'] ?? 60));
        $stats = $repo->getHospitalStats($hospitalId);
        $recentCampaigns = $repo->getRecentCampaigns($hospitalId, 2);
        $recentInteractions = $repo->getRecentInteractions($hospitalId, 2);
        $ttl = (int)($config['app']['dashboard_cache_ttl'] ?? 60);

        return Response::html($view->render('pages/dashboard', [
            'message' => 'Portal Administrativo (SSR)',
            'user' => $user,
            'stats' => $stats,
            'recentCampaigns' => $recentCampaigns,
            'recentInteractions' => $recentInteractions,
            'cacheTtl' => $ttl,
            'csrf' => Csrf::token(),
        ]));
    }

    public function doctor(Request $request, Db $db, View $view, array $config): Response
    {
        return Response::html($view->render('pages/dashboard_doctor', [
            'message' => 'Portal Médico (SSR)',
            'user' => Auth::user(),
            'csrf' => Csrf::token(),
        ]));
    }

    public function patient(Request $request, Db $db, View $view, array $config): Response
    {
        $user = Auth::user();
        $patientId = is_array($user) ? (string)($user['patient_id'] ?? $user['user_id'] ?? '') : '';
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';

        if (trim($patientId) === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/patient/login');
        }

        $patientsRepo = new PatientsRepository($db);
        $patientData = null;
        if ($hospitalId !== '') {
            $patientData = $patientsRepo->findByHospital($hospitalId, $patientId);
        }
        if (!$patientData) {
            $patientData = $patientsRepo->findById($patientId);
        }

        $patientError = null;
        $vitalSigns = [];
        $latestVitals = null;
        $healthStatus = ['status' => 'Sin datos', 'alerts' => []];
        $monthlyAverage = null;

        if (!$patientData) {
            $patientError = 'No se encontró tu perfil de paciente';
        } else {
            try {
                $vitalSigns = $db->fetchAll(
                    'SELECT id, paciente_id, fecha, temperatura, presion_sistolica, presion_diastolica, ritmo_cardiaco, glucometria, peso
                     FROM public.signos_vitales
                     WHERE paciente_id = :patient_id
                     ORDER BY fecha DESC NULLS LAST, id DESC
                     LIMIT 200',
                    ['patient_id' => $patientData['patient_id']]
                );
            } catch (Throwable $e) {
                $vitalSigns = [];
                $healthStatus = ['status' => 'Sin datos', 'alerts' => ['No fue posible cargar signos vitales']];
            }

            if (count($vitalSigns) === 0) {
                $latestVitals = [
                    'temperatura' => 0,
                    'ritmo_cardiaco' => 0,
                    'glucometria' => 0,
                    'presion_sistolica' => 0,
                    'presion_diastolica' => 0,
                    'fecha' => (new DateTimeImmutable())->format(DATE_ATOM),
                ];
                if (($healthStatus['status'] ?? '') !== 'Sin datos') {
                    $healthStatus = ['status' => 'Sin datos', 'alerts' => ['No hay registros']];
                }
            } else {
                $latestVitals = $vitalSigns[0];
                $healthStatus = $this->checkHealthAlerts($latestVitals);
                $monthlyAverage = $this->computeMonthlyAverage($vitalSigns);
            }
        }

        $hasNoData = $this->hasNoData($vitalSigns, $latestVitals);
        $hasAlerts = !$hasNoData && (count((array)($healthStatus['alerts'] ?? [])) > 0) && (($healthStatus['status'] ?? '') !== 'Sin datos');
        $vitalsActive = (bool)$latestVitals && !$hasNoData;

        $hr = (int)round($this->num($latestVitals['ritmo_cardiaco'] ?? 0));
        $sys = (int)round($this->num($latestVitals['presion_sistolica'] ?? 0));
        $dia = (int)round($this->num($latestVitals['presion_diastolica'] ?? 0));
        $temp = (float)$this->num($latestVitals['temperatura'] ?? 0);
        $gluc = (int)round($this->num($latestVitals['glucometria'] ?? 0));

        $avgHr = (int)round($this->num($monthlyAverage['heartRate'] ?? 0));
        $avgSys = (int)round($this->num($monthlyAverage['bloodPressureSys'] ?? 0));
        $avgDia = (int)round($this->num($monthlyAverage['bloodPressureDia'] ?? 0));
        $avgTemp = (float)$this->num($monthlyAverage['temperature'] ?? 0);
        $avgGluc = (int)round($this->num($monthlyAverage['glucometry'] ?? 0));

        $hrLabel = ($hr === 0) ? 'Sin datos' : (($hr < 60) ? 'Bajo' : (($hr > 100) ? 'Alto' : 'Normal'));
        $bpLabel = (($sys === 0) && ($dia === 0)) ? 'Sin datos' : ((($sys > 140) || ($dia > 90)) ? 'Alta' : ((($sys < 90) || ($dia < 60)) ? 'Baja' : 'Normal'));
        $tempLabel = ($temp == 0.0) ? 'Sin datos' : (($temp > 37.5) ? 'Fiebre' : (($temp < 35.0) ? 'Baja' : 'Normal'));
        $glucLabel = ($gluc === 0) ? 'Sin datos' : (($gluc > 140) ? 'Alta' : (($gluc < 70) ? 'Baja' : 'Normal'));

        $bpNeedleDeg = (!$vitalsActive || !$sys) ? -70.0 : (-90.0 + (($this->clamp($sys, 70, 180) - 70) / (180 - 70)) * 180.0);
        $avgBpNeedleDeg = (!$monthlyAverage || !$avgSys) ? -70.0 : (-90.0 + (($this->clamp($avgSys, 70, 180) - 70) / (180 - 70)) * 180.0);
        $tempFillPct = (!$vitalsActive || !$temp) ? 0.0 : (($this->clamp($temp, 34, 40) - 34) / (40 - 34)) * 100.0;
        $avgTempFillPct = (!$monthlyAverage || !$avgTemp) ? 0.0 : (($this->clamp($avgTemp, 34, 40) - 34) / (40 - 34)) * 100.0;
        $glucFillPct = (!$vitalsActive || !$gluc) ? 0.0 : (($this->clamp($gluc, 50, 220) - 50) / (220 - 50)) * 100.0;
        $avgGlucFillPct = (!$monthlyAverage || !$avgGluc) ? 0.0 : (($this->clamp($avgGluc, 50, 220) - 50) / (220 - 50)) * 100.0;

        $latestDateLabel = $this->formatDateLabel(is_array($latestVitals) ? (string)($latestVitals['fecha'] ?? '') : '');
        $firstName = $this->firstName((string)($patientData['name'] ?? ''));

        return Response::html($view->render('pages/dashboard_patient', [
            'user' => $user,
            'csrf' => Csrf::token(),
            'patientData' => $patientData,
            'patientError' => $patientError,
            'vitalSigns' => $vitalSigns,
            'latestVitals' => $latestVitals,
            'latestDateLabel' => $latestDateLabel,
            'healthStatus' => $healthStatus,
            'monthlyAverage' => $monthlyAverage,
            'hasAlerts' => $hasAlerts,
            'hasNoData' => $hasNoData,
            'firstName' => $firstName,
            'metrics' => [
                'vitalsActive' => $vitalsActive,
                'hr' => $hr,
                'sys' => $sys,
                'dia' => $dia,
                'temp' => $temp,
                'gluc' => $gluc,
                'avgHr' => $avgHr,
                'avgSys' => $avgSys,
                'avgDia' => $avgDia,
                'avgTemp' => $avgTemp,
                'avgGluc' => $avgGluc,
                'hrLabel' => $hrLabel,
                'bpLabel' => $bpLabel,
                'tempLabel' => $tempLabel,
                'glucLabel' => $glucLabel,
                'bpNeedleDeg' => $bpNeedleDeg,
                'avgBpNeedleDeg' => $avgBpNeedleDeg,
                'tempFillPct' => $tempFillPct,
                'avgTempFillPct' => $avgTempFillPct,
                'glucFillPct' => $glucFillPct,
                'avgGlucFillPct' => $avgGlucFillPct,
            ],
            'success' => Session::pull('success', null),
            'error' => Session::pull('error', null),
        ]));
    }

    public function patientHealth(Request $request, Db $db, View $view, array $config): Response
    {
        $user = Auth::user();
        $patientId = is_array($user) ? (string)($user['patient_id'] ?? $user['user_id'] ?? '') : '';
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';

        if (trim($patientId) === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/patient/login');
        }

        $patientsRepo = new PatientsRepository($db);
        $patientData = null;
        if ($hospitalId !== '') {
            $patientData = $patientsRepo->findByHospital($hospitalId, $patientId);
        }
        if (!$patientData) {
            $patientData = $patientsRepo->findById($patientId);
        }

        if (!$patientData) {
            return Response::html($view->render('pages/patient_health', [
                'csrf' => Csrf::token(),
                'patientData' => null,
                'patientError' => 'No se encontró tu perfil de paciente',
                'existingRecord' => null,
                'error' => Session::pull('error', null),
                'success' => Session::pull('success', null),
            ]), 404);
        }

        $existingRecord = null;
        try {
            $existingRecord = $db->fetchOne(
                'SELECT id, paciente_id, fecha, temperatura, presion_sistolica, presion_diastolica, ritmo_cardiaco, glucometria, peso
                 FROM public.signos_vitales
                 WHERE paciente_id = :patient_id
                 ORDER BY fecha DESC NULLS LAST, id DESC
                 LIMIT 1',
                ['patient_id' => $patientData['patient_id']]
            );
        } catch (Throwable $e) {
            $existingRecord = null;
        }

        return Response::html($view->render('pages/patient_health', [
            'csrf' => Csrf::token(),
            'patientData' => $patientData,
            'patientError' => null,
            'existingRecord' => $existingRecord,
            'error' => Session::pull('error', null),
            'success' => Session::pull('success', null),
        ]));
    }

    public function patientHealthSave(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            Session::flash('error', 'Solicitud inválida.');
            return Response::redirect('/patient/health');
        }

        $user = Auth::user();
        $patientId = is_array($user) ? (string)($user['patient_id'] ?? $user['user_id'] ?? '') : '';
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';

        if (trim($patientId) === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/patient/login');
        }

        $patientsRepo = new PatientsRepository($db);
        $patientData = null;
        if ($hospitalId !== '') {
            $patientData = $patientsRepo->findByHospital($hospitalId, $patientId);
        }
        if (!$patientData) {
            $patientData = $patientsRepo->findById($patientId);
        }

        if (!$patientData) {
            Session::flash('error', 'No se encontró tu perfil de paciente.');
            return Response::redirect('/patient/health');
        }

        $parse = static function (mixed $v): ?float {
            $t = trim((string)($v ?? ''));
            if ($t === '') return null;
            $n = (float)$t;
            return is_finite($n) ? $n : null;
        };

        $inputTemp = $parse($request->post['temperatura'] ?? null);
        $inputSys = $parse($request->post['presion_sistolica'] ?? null);
        $inputDia = $parse($request->post['presion_diastolica'] ?? null);
        $inputHr = $parse($request->post['ritmo_cardiaco'] ?? null);
        $inputGluc = $parse($request->post['glucometria'] ?? null);
        $inputPeso = $parse($request->post['peso'] ?? null);

        $hasAnyInput = false;
        foreach ([$inputTemp, $inputSys, $inputDia, $inputHr, $inputGluc, $inputPeso] as $val) {
            if ($val !== null) {
                $hasAnyInput = true;
                break;
            }
        }

        if (!$hasAnyInput) {
            Session::flash('error', 'Registra al menos un signo vital para guardar.');
            return Response::redirect('/patient/health');
        }

        $existingRecord = null;
        try {
            $existingRecord = $db->fetchOne(
                'SELECT id, paciente_id, temperatura, presion_sistolica, presion_diastolica, ritmo_cardiaco, glucometria, peso
                 FROM public.signos_vitales
                 WHERE paciente_id = :patient_id
                 ORDER BY fecha DESC NULLS LAST, id DESC
                 LIMIT 1',
                ['patient_id' => $patientData['patient_id']]
            );
        } catch (Throwable $e) {
            $existingRecord = null;
        }

        $base = is_array($existingRecord) ? $existingRecord : [];
        $now = (new DateTimeImmutable())->format(DATE_ATOM);

        $payload = [
            'paciente_id' => $patientData['patient_id'],
            'fecha' => $now,
            'temperatura' => $inputTemp ?? (is_numeric($base['temperatura'] ?? null) ? (float)$base['temperatura'] : 0.0),
            'presion_sistolica' => $inputSys ?? (is_numeric($base['presion_sistolica'] ?? null) ? (float)$base['presion_sistolica'] : 0.0),
            'presion_diastolica' => $inputDia ?? (is_numeric($base['presion_diastolica'] ?? null) ? (float)$base['presion_diastolica'] : 0.0),
            'ritmo_cardiaco' => $inputHr ?? (is_numeric($base['ritmo_cardiaco'] ?? null) ? (float)$base['ritmo_cardiaco'] : 0.0),
            'glucometria' => $inputGluc ?? (is_numeric($base['glucometria'] ?? null) ? (float)$base['glucometria'] : 0.0),
            'peso' => $inputPeso ?? (is_numeric($base['peso'] ?? null) ? (float)$base['peso'] : null),
        ];

        try {
            $shouldUpdateInitial =
                is_array($existingRecord)
                && ($this->num($existingRecord['temperatura'] ?? 0) == 0.0)
                && ((int)round($this->num($existingRecord['ritmo_cardiaco'] ?? 0)) === 0)
                && ((int)round($this->num($existingRecord['glucometria'] ?? 0)) === 0);

            if ($shouldUpdateInitial) {
                $db->execute(
                    'UPDATE public.signos_vitales
                     SET fecha = :fecha,
                         temperatura = :temperatura,
                         presion_sistolica = :presion_sistolica,
                         presion_diastolica = :presion_diastolica,
                         ritmo_cardiaco = :ritmo_cardiaco,
                         glucometria = :glucometria,
                         peso = :peso
                     WHERE id = :id AND paciente_id = :paciente_id',
                    [
                        'fecha' => $payload['fecha'],
                        'temperatura' => $payload['temperatura'],
                        'presion_sistolica' => $payload['presion_sistolica'],
                        'presion_diastolica' => $payload['presion_diastolica'],
                        'ritmo_cardiaco' => $payload['ritmo_cardiaco'],
                        'glucometria' => $payload['glucometria'],
                        'peso' => $payload['peso'],
                        'id' => $existingRecord['id'],
                        'paciente_id' => $payload['paciente_id'],
                    ]
                );
            } else {
                $db->execute(
                    'INSERT INTO public.signos_vitales (paciente_id, fecha, temperatura, presion_sistolica, presion_diastolica, ritmo_cardiaco, glucometria, peso)
                     VALUES (:paciente_id, :fecha, :temperatura, :presion_sistolica, :presion_diastolica, :ritmo_cardiaco, :glucometria, :peso)',
                    [
                        'paciente_id' => $payload['paciente_id'],
                        'fecha' => $payload['fecha'],
                        'temperatura' => $payload['temperatura'],
                        'presion_sistolica' => $payload['presion_sistolica'],
                        'presion_diastolica' => $payload['presion_diastolica'],
                        'ritmo_cardiaco' => $payload['ritmo_cardiaco'],
                        'glucometria' => $payload['glucometria'],
                        'peso' => $payload['peso'],
                    ]
                );
            }

            Session::flash('success', '✅ Registro guardado');
            return Response::redirect('/patient/dashboard');
        } catch (Throwable $e) {
            Session::flash('error', 'No se pudieron guardar tus signos vitales.');
            return Response::redirect('/patient/health');
        }
    }

    public function patientPrograms(Request $request, Db $db, View $view, array $config): Response
    {
        $patientData = $this->requirePatientData($db);
        if (!$patientData) {
            return Response::redirect('/patient/login');
        }

        $programs = [];
        $programsError = null;

        try {
            $programs = $db->fetchAll(
                'SELECT id, patient_id, program_name, doctor_name, next_check_date, status, created_at
                 FROM public.patient_programs
                 WHERE patient_id = :patient_id
                 ORDER BY created_at DESC NULLS LAST, id DESC',
                ['patient_id' => $patientData['patient_id']]
            );
        } catch (Throwable $e) {
            $msg = strtolower((string)$e->getMessage());
            if (str_contains($msg, 'patient_programs') && str_contains($msg, 'does not exist')) {
                $programs = [];
                $programsError = null;
            } else {
                $programs = [];
                $programsError = 'Error cargando programas';
            }
        }

        return Response::html($view->render('pages/patient_programs', [
            'csrf' => Csrf::token(),
            'patientData' => $patientData,
            'programs' => $programs,
            'programsError' => $programsError,
        ]));
    }

    public function patientHistory(Request $request, Db $db, View $view, array $config): Response
    {
        $patientData = $this->requirePatientData($db);
        if (!$patientData) {
            return Response::redirect('/patient/login');
        }

        $history = [];
        $historyError = null;

        try {
            $history = $db->fetchAll(
                'SELECT id, patient_id, record_type, record_date, doctor_name, notes, attachment_url, created_at
                 FROM public.clinical_records
                 WHERE patient_id = :patient_id
                 ORDER BY record_date DESC NULLS LAST, created_at DESC NULLS LAST, id DESC',
                ['patient_id' => $patientData['patient_id']]
            );
        } catch (Throwable $e) {
            $msg = strtolower((string)$e->getMessage());
            if (str_contains($msg, 'clinical_records') && str_contains($msg, 'does not exist')) {
                $history = [];
                $historyError = 'La historia clínica aún no está configurada en el sistema.';
            } else {
                $history = [];
                $historyError = 'Error cargando historia clínica';
            }
        }

        return Response::html($view->render('pages/patient_history', [
            'csrf' => Csrf::token(),
            'patientData' => $patientData,
            'history' => $history,
            'historyError' => $historyError,
        ]));
    }

    public function patientHistoryDownload(Request $request, Db $db, View $view, array $config): Response
    {
        $patientData = $this->requirePatientData($db);
        if (!$patientData) {
            return Response::redirect('/patient/login');
        }

        $id = (string)($request->params['id'] ?? '');
        if ($id === '') {
            return Response::redirect('/patient/history');
        }

        $item = null;
        try {
            $item = $db->fetchOne(
                'SELECT id, patient_id, record_type, record_date, doctor_name, notes, attachment_url
                 FROM public.clinical_records
                 WHERE patient_id = :patient_id AND id = :id
                 LIMIT 1',
                ['patient_id' => $patientData['patient_id'], 'id' => $id]
            );
        } catch (Throwable $e) {
            $item = null;
        }

        if (!$item) {
            return Response::redirect('/patient/history');
        }

        $attachment = trim((string)($item['attachment_url'] ?? ''));
        if ($attachment !== '') {
            return Response::redirect($attachment);
        }

        $lines = [
            'Tipo: ' . ((string)($item['record_type'] ?? 'Registro clínico')),
            'Fecha: ' . $this->formatDateLabel((string)($item['record_date'] ?? '')),
            'Doctor: ' . ((string)($item['doctor_name'] ?? '')),
            '',
            (string)($item['notes'] ?? ''),
        ];
        $text = implode("\n", $lines);

        $datePart = $this->safeIsoDatePart((string)($item['record_date'] ?? ''));
        $filename = 'reporte_' . ($datePart !== '' ? $datePart : 'sin-fecha') . '.txt';

        return new Response($text, 200, [
            'Content-Type' => 'text/plain; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    public function patientInteractions(Request $request, Db $db, View $view, array $config): Response
    {
        $patientData = $this->requirePatientData($db);
        if (!$patientData) {
            return Response::redirect('/patient/login');
        }

        $rows = [];
        try {
            $rows = $db->fetchAll(
                'SELECT id, tipo, estado, prioridad, asunto, mensaje, created_at
                 FROM public.interactions
                 WHERE patient_id = :patient_id
                 ORDER BY created_at DESC NULLS LAST, id DESC
                 LIMIT 200',
                ['patient_id' => $patientData['patient_id']]
            );
        } catch (Throwable $e) {
            $rows = [];
        }

        return Response::html($view->render('pages/patient_interactions', [
            'csrf' => Csrf::token(),
            'patientData' => $patientData,
            'rows' => $rows,
            'error' => Session::pull('error', null),
            'success' => Session::pull('success', null),
        ]));
    }

    public function patientInteractionsCreate(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            Session::flash('error', 'Solicitud inválida.');
            return Response::redirect('/patient/interactions');
        }

        $patientData = $this->requirePatientData($db);
        if (!$patientData) {
            return Response::redirect('/patient/login');
        }

        $tipo = trim((string)($request->post['tipo'] ?? ''));
        $asunto = trim((string)($request->post['asunto'] ?? ''));
        $mensaje = trim((string)($request->post['mensaje'] ?? ''));

        if ($tipo === '' || $asunto === '' || $mensaje === '') {
            Session::flash('error', 'Por favor completa todos los campos.');
            return Response::redirect('/patient/interactions');
        }

        $hospitalId = (string)($patientData['hospital_id'] ?? '');
        if ($hospitalId === '') {
            Session::flash('error', 'No se encontró tu hospital asignado.');
            return Response::redirect('/patient/interactions');
        }

        try {
            $db->execute(
                'INSERT INTO public.interactions (hospital_id, patient_id, patient_name, patient_phone, patient_email, tipo, asunto, mensaje, prioridad, estado)
                 VALUES (:hospital_id, :patient_id, :patient_name, :patient_phone, :patient_email, :tipo, :asunto, :mensaje, :prioridad, :estado)',
                [
                    'hospital_id' => $hospitalId,
                    'patient_id' => $patientData['patient_id'],
                    'patient_name' => $patientData['name'] ?? '',
                    'patient_phone' => $patientData['phone'] ?? '',
                    'patient_email' => $patientData['email'] ?? '',
                    'tipo' => $tipo,
                    'asunto' => $asunto,
                    'mensaje' => $mensaje,
                    'prioridad' => 'media',
                    'estado' => 'pendiente',
                ]
            );

            Session::flash('success', '✅ Solicitud enviada');
            return Response::redirect('/patient/interactions');
        } catch (Throwable $e) {
            Session::flash('error', 'No se pudo enviar tu solicitud. Intenta de nuevo.');
            return Response::redirect('/patient/interactions');
        }
    }

    public function patientSchedule(Request $request, Db $db, View $view, array $config): Response
    {
        $patientData = $this->requirePatientData($db);
        if (!$patientData) {
            return Response::redirect('/patient/login');
        }

        return Response::html($view->render('pages/patient_schedule', [
            'csrf' => Csrf::token(),
            'patientData' => $patientData,
        ]));
    }

    private function requirePatientData(Db $db): ?array
    {
        $user = Auth::user();
        $patientId = is_array($user) ? (string)($user['patient_id'] ?? $user['user_id'] ?? '') : '';
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if (trim($patientId) === '') {
            return null;
        }

        $patientsRepo = new PatientsRepository($db);
        $patientData = null;
        if ($hospitalId !== '') {
            $patientData = $patientsRepo->findByHospital($hospitalId, $patientId);
        }
        if (!$patientData) {
            $patientData = $patientsRepo->findById($patientId);
        }
        return $patientData ?: null;
    }

    private function calculateAge(?string $birthdate): ?int
    {
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
    }

    private function checkHealthAlerts(array $vitals): array
    {
        $alerts = [];
        $status = 'Saludable';

        $temp = (float)$this->num($vitals['temperatura'] ?? 0);
        $hr = (float)$this->num($vitals['ritmo_cardiaco'] ?? 0);
        $sys = (float)$this->num($vitals['presion_sistolica'] ?? 0);
        $dia = (float)$this->num($vitals['presion_diastolica'] ?? 0);
        $gluc = (float)$this->num($vitals['glucometria'] ?? 0);

        if ($temp == 0.0 && $hr == 0.0 && $sys == 0.0 && $dia == 0.0 && $gluc == 0.0) {
            return ['status' => 'Sin datos', 'alerts' => ['Registra tus primeros signos vitales']];
        }

        if ($temp > 37.5) {
            $alerts[] = 'Fiebre detectada';
            $status = 'Fiebre';
        } elseif ($temp < 35.0 && $temp > 0.0) {
            $alerts[] = 'Hipotermia';
            $status = 'Hipotermia';
        }

        if ($sys > 140 || $dia > 90) {
            $alerts[] = 'Presión arterial alta';
            $status = 'Hipertensión';
        } elseif (($sys > 0 && $sys < 90) || ($dia > 0 && $dia < 60)) {
            $alerts[] = 'Presión arterial baja';
            $status = 'Hipotensión';
        }

        if ($hr > 100) {
            $alerts[] = 'Taquicardia';
            $status = 'Taquicardia';
        } elseif ($hr > 0 && $hr < 60) {
            $alerts[] = 'Bradicardia';
            $status = 'Bradicardia';
        }

        if ($gluc > 140) {
            $alerts[] = 'Glucosa elevada';
            $status = 'Hiperglucemia';
        } elseif ($gluc > 0 && $gluc < 70) {
            $alerts[] = 'Glucosa baja';
            $status = 'Hipoglucemia';
        }

        return ['status' => $status, 'alerts' => $alerts];
    }

    private function computeMonthlyAverage(array $vitals): ?array
    {
        $oneMonthAgo = (new DateTimeImmutable())->sub(new DateInterval('P1M'));
        $recent = [];

        foreach ($vitals as $v) {
            $fecha = trim((string)($v['fecha'] ?? ''));
            if ($fecha === '') continue;
            try {
                $dt = new DateTimeImmutable($fecha);
            } catch (Throwable $e) {
                continue;
            }
            if ($dt < $oneMonthAgo) continue;

            $hasValid =
                $this->num($v['temperatura'] ?? 0) > 0
                || $this->num($v['ritmo_cardiaco'] ?? 0) > 0
                || $this->num($v['glucometria'] ?? 0) > 0
                || $this->num($v['presion_sistolica'] ?? 0) > 0;
            if (!$hasValid) continue;
            $recent[] = $v;
        }

        if (count($recent) === 0) return null;

        $calc = function (string $field) use ($recent): float {
            $vals = [];
            foreach ($recent as $r) {
                $n = $this->num($r[$field] ?? 0);
                if ($n > 0) $vals[] = $n;
            }
            if (count($vals) === 0) return 0.0;
            return array_sum($vals) / count($vals);
        };

        return [
            'heartRate' => (int)round($calc('ritmo_cardiaco')),
            'temperature' => number_format($calc('temperatura'), 1, '.', ''),
            'glucometry' => (int)round($calc('glucometria')),
            'bloodPressureSys' => (int)round($calc('presion_sistolica')),
            'bloodPressureDia' => (int)round($calc('presion_diastolica')),
        ];
    }

    private function hasNoData(array $vitals, ?array $latestVitals): bool
    {
        if (count($vitals) === 0) return true;
        $t = $this->num($latestVitals['temperatura'] ?? 0);
        $hr = $this->num($latestVitals['ritmo_cardiaco'] ?? 0);
        return $t == 0.0 && $hr == 0.0;
    }

    private function num(mixed $v): float
    {
        if ($v === null) return 0.0;
        if (is_int($v) || is_float($v)) return (float)$v;
        $t = trim((string)$v);
        if ($t === '') return 0.0;
        $n = (float)$t;
        return is_finite($n) ? $n : 0.0;
    }

    private function clamp(float|int $v, float|int $min, float|int $max): float
    {
        $n = (float)$v;
        $minF = (float)$min;
        $maxF = (float)$max;
        if ($n < $minF) return $minF;
        if ($n > $maxF) return $maxF;
        return $n;
    }

    private function firstName(string $name): string
    {
        $name = trim($name);
        if ($name === '') return '';
        $parts = preg_split('/\s+/', $name) ?: [];
        $parts = array_values(array_filter($parts, static fn ($p) => trim((string)$p) !== ''));
        return isset($parts[0]) ? (string)$parts[0] : '';
    }

    private function formatDateLabel(string $timestamp): string
    {
        $timestamp = trim($timestamp);
        if ($timestamp === '') return 'Sin registros';
        try {
            $dt = new DateTimeImmutable($timestamp);
        } catch (Throwable $e) {
            return 'Sin registros';
        }
        return $dt->format('d/m/Y');
    }

    private function safeIsoDatePart(string $timestamp): string
    {
        $timestamp = trim($timestamp);
        if ($timestamp === '') return '';
        try {
            $dt = new DateTimeImmutable($timestamp);
        } catch (Throwable $e) {
            return '';
        }
        return $dt->format('Y-m-d');
    }
}
