<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Infrastructure\Db;
use App\Repositories\DashboardRepository;
use App\Support\Auth\Auth;
use App\Support\Http\Request;
use App\Support\Http\Response;
use App\Support\Session\Session;
use App\View\View;

final class ReportsController
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

        $totalDestinatarios = (int)($stats['total_destinatarios'] ?? 0);
        $totalEntregados = (int)($stats['total_entregados'] ?? 0);
        $deliveryRate = $totalDestinatarios > 0 ? round(($totalEntregados / $totalDestinatarios) * 100, 1) : 0.0;

        return Response::html($view->render('pages/reports', [
            'user' => $user,
            'stats' => $stats,
            'deliveryRate' => $deliveryRate,
        ]));
    }

    public function export(Request $request, Db $db, View $view, array $config): Response
    {
        $user = Auth::user();
        $hospitalId = is_array($user) ? (string)($user['hospital_id'] ?? '') : '';
        if ($hospitalId === '') {
            Auth::logout();
            Session::destroy();
            return Response::redirect('/login');
        }

        $type = strtolower((string)($request->params['type'] ?? ''));
        if (!in_array($type, ['patients', 'campaigns', 'interactions'], true)) {
            return Response::redirect('/reports');
        }

        if ($type === 'patients') {
            $rows = $db->fetchAll(
                'SELECT patient_id, name, phone, email, document, birthdate, sex, city, program, address, created_at
                 FROM public.patients
                 WHERE hospital_id = :hospital_id
                 ORDER BY created_at DESC NULLS LAST, patient_id DESC',
                ['hospital_id' => $hospitalId]
            );
            $columns = ['ID', 'Nombre', 'Teléfono', 'Email', 'Documento', 'Fecha Nacimiento', 'Sexo', 'Ciudad', 'Programa', 'Dirección', 'Fecha Registro'];
            $body = $this->csvFromRows($columns, array_map(static function (array $r): array {
                return [
                    'ID' => (string)($r['patient_id'] ?? ''),
                    'Nombre' => (string)($r['name'] ?? ''),
                    'Teléfono' => (string)($r['phone'] ?? ''),
                    'Email' => (string)($r['email'] ?? ''),
                    'Documento' => (string)($r['document'] ?? ''),
                    'Fecha Nacimiento' => (string)($r['birthdate'] ?? ''),
                    'Sexo' => (string)($r['sex'] ?? ''),
                    'Ciudad' => (string)($r['city'] ?? ''),
                    'Programa' => (string)($r['program'] ?? ''),
                    'Dirección' => (string)($r['address'] ?? ''),
                    'Fecha Registro' => (string)($r['created_at'] ?? ''),
                ];
            }, $rows));
            return $this->csvResponse($body, 'pacientes.csv');
        }

        if ($type === 'campaigns') {
            $rows = $db->fetchAll(
                'SELECT id, nombre, estado, created_at, fecha_programada, hora_programada, fecha_envio, destinatarios, enviados, entregados, fallidos
                 FROM public.campaigns
                 WHERE hospital_id = :hospital_id
                 ORDER BY created_at DESC NULLS LAST, id DESC',
                ['hospital_id' => $hospitalId]
            );
            $columns = ['ID', 'Nombre', 'Estado', 'Fecha Creación', 'Fecha Programada', 'Hora Programada', 'Fecha Envío', 'Destinatarios', 'Enviados', 'Entregados', 'Fallidos'];
            $body = $this->csvFromRows($columns, array_map(static function (array $r): array {
                return [
                    'ID' => (string)($r['id'] ?? ''),
                    'Nombre' => (string)($r['nombre'] ?? ''),
                    'Estado' => (string)($r['estado'] ?? ''),
                    'Fecha Creación' => (string)($r['created_at'] ?? ''),
                    'Fecha Programada' => (string)($r['fecha_programada'] ?? ''),
                    'Hora Programada' => (string)($r['hora_programada'] ?? ''),
                    'Fecha Envío' => (string)($r['fecha_envio'] ?? ''),
                    'Destinatarios' => (string)($r['destinatarios'] ?? ''),
                    'Enviados' => (string)($r['enviados'] ?? ''),
                    'Entregados' => (string)($r['entregados'] ?? ''),
                    'Fallidos' => (string)($r['fallidos'] ?? ''),
                ];
            }, $rows));
            return $this->csvResponse($body, 'campanas.csv');
        }

        $rows = $db->fetchAll(
            'SELECT i.id, i.tipo, i.estado, i.prioridad, i.asunto, i.mensaje, i.created_at,
                    COALESCE(p.patient_id, i.patient_id) AS patient_id,
                    COALESCE(p.name, i.patient_name) AS patient_name
             FROM public.interactions i
             LEFT JOIN public.patients p ON p.patient_id = i.patient_id
             WHERE i.hospital_id = :hospital_id
             ORDER BY i.created_at DESC NULLS LAST, i.id DESC',
            ['hospital_id' => $hospitalId]
        );
        $columns = ['ID', 'Tipo', 'Estado', 'Prioridad', 'Asunto', 'Mensaje', 'Fecha', 'Paciente ID', 'Paciente'];
        $body = $this->csvFromRows($columns, array_map(static function (array $r): array {
            return [
                'ID' => (string)($r['id'] ?? ''),
                'Tipo' => (string)($r['tipo'] ?? ''),
                'Estado' => (string)($r['estado'] ?? ''),
                'Prioridad' => (string)($r['prioridad'] ?? ''),
                'Asunto' => (string)($r['asunto'] ?? ''),
                'Mensaje' => (string)($r['mensaje'] ?? ''),
                'Fecha' => (string)($r['created_at'] ?? ''),
                'Paciente ID' => (string)($r['patient_id'] ?? ''),
                'Paciente' => (string)($r['patient_name'] ?? ''),
            ];
        }, $rows));
        return $this->csvResponse($body, 'interacciones.csv');
    }

    private function csvFromRows(array $columns, array $rows): string
    {
        $out = [];
        $out[] = implode(',', array_map([$this, 'quoteCsvCell'], $columns));
        foreach ($rows as $row) {
            $line = [];
            foreach ($columns as $c) {
                $line[] = $this->quoteCsvCell($row[$c] ?? '');
            }
            $out[] = implode(',', $line);
        }
        return implode("\r\n", $out) . "\r\n";
    }

    private function quoteCsvCell(mixed $value): string
    {
        $str = $value === null ? '' : (string)$value;
        $str = str_replace('"', '""', $str);
        return '"' . $str . '"';
    }

    private function csvResponse(string $csv, string $filename): Response
    {
        return new Response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-store',
        ]);
    }
}
