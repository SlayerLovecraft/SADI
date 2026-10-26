<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Infrastructure\Db;
use App\Support\Auth\Auth;
use App\Support\Http\Request;
use App\Support\Http\Response;
use App\Support\Security\Csrf;
use App\Support\Session\Session;
use App\View\View;

final class AuthController
{
    private function isInstitutionalEmail(string $email): bool
    {
        $email = strtolower(trim($email));
        if ($email === '' || !str_contains($email, '@')) return false;
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return false;

        $blocked = ['@gmail.com', '@hotmail.com', '@yahoo.com', '@outlook.com'];
        foreach ($blocked as $domain) {
            if (str_contains($email, $domain)) return false;
        }
        return true;
    }

    public function showLogin(Request $request, Db $db, View $view, array $config): Response
    {
        if (Auth::check()) {
            $role = Auth::role();
            if ($role === 'doctor') return Response::redirect('/doctor/dashboard');
            if ($role === 'patient') return Response::redirect('/patient/dashboard');
            return Response::redirect('/dashboard');
        }

        return Response::html($view->render('pages/auth_login', [
            'error' => Session::pull('error', null),
            'success' => Session::pull('success', null),
            'csrf' => Csrf::token(),
        ]));
    }

    public function login(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::html($view->render('pages/auth_login', [
                'error' => 'Solicitud inválida.',
                'csrf' => Csrf::token(),
            ]), 419);
        }

        $email = strtolower(trim((string)($request->post['email'] ?? '')));
        $password = (string)($request->post['password'] ?? '');

        if ($email === '' || $password === '') {
            return Response::html($view->render('pages/auth_login', [
                'error' => 'Correo y contraseña son requeridos.',
                'success' => null,
                'csrf' => Csrf::token(),
            ]), 422);
        }

        if (!$this->isInstitutionalEmail($email)) {
            return Response::html($view->render('pages/auth_login', [
                'error' => 'Debe usar un correo institucional (EPS/IPS). No se aceptan Gmail, Hotmail, Yahoo u Outlook.',
                'success' => null,
                'csrf' => Csrf::token(),
            ]), 422);
        }

        try {
            $row = $this->fetchHospitalByEmail($db, $email);
            if (!$row) {
                return Response::html($view->render('pages/auth_login', [
                    'error' => 'Hospital no registrado en el sistema.',
                    'success' => null,
                    'csrf' => Csrf::token(),
                ]), 401);
            }

            $supabase = $this->supabasePasswordSignIn($config, $email, $password);
            if (($supabase['used'] ?? false) === true) {
                if (($supabase['success'] ?? false) !== true) {
                    $msg = (string)($supabase['error'] ?? 'Contraseña incorrecta o cuenta no verificada');
                    $raw = strtolower($msg);
                    if (str_contains($raw, 'email not confirmed') || str_contains($raw, 'not confirmed') || str_contains($raw, 'confirm')) {
                        $msg = 'Tu cuenta aún no ha sido confirmada. Revisa tu correo y haz clic en el enlace de verificación.';
                    } elseif (str_contains($raw, 'invalid login credentials') || str_contains($raw, 'invalid') || str_contains($raw, 'credentials')) {
                        $msg = 'Contraseña incorrecta o cuenta no verificada';
                    }

                    return Response::html($view->render('pages/auth_login', [
                        'error' => $msg,
                        'success' => null,
                        'csrf' => Csrf::token(),
                    ]), 401);
                }

                $token = is_array($supabase['data'] ?? null) ? (string)($supabase['data']['access_token'] ?? '') : '';
                Auth::login([
                    'role' => 'hospital_admin',
                    'user_id' => $row['hospital_id'],
                    'hospital_id' => $row['hospital_id'],
                    'email' => $row['email'],
                    'name' => $row['name'] ?? $row['email'],
                    'supabase_access_token' => $token !== '' ? $token : null,
                ]);

                return Response::redirect('/dashboard');
            }

            $stored = $row['password_hash'] ?? null;
            if (!is_string($stored) || $stored === '') {
                return Response::html($view->render('pages/auth_login', [
                    'error' => 'El hospital no tiene contraseña configurada. Configure una contraseña en /setup/hospital-password.',
                    'success' => null,
                    'csrf' => Csrf::token(),
                ]), 403);
            }

            if (!$this->verifyPassword($password, $stored)) {
                return Response::html($view->render('pages/auth_login', [
                    'error' => 'Credenciales inválidas.',
                    'success' => null,
                    'csrf' => Csrf::token(),
                ]), 401);
            }

            if (!$this->isHash($stored)) {
                $newHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
                $db->execute('UPDATE public.hospitals SET password_hash = :hash WHERE hospital_id = :id', [
                    'hash' => $newHash,
                    'id' => $row['hospital_id'],
                ]);
            }

            Auth::login([
                'role' => 'hospital_admin',
                'user_id' => $row['hospital_id'],
                'hospital_id' => $row['hospital_id'],
                'email' => $row['email'],
                'name' => $row['name'] ?? $row['email'],
            ]);

            return Response::redirect('/dashboard');
        } catch (\Throwable $e) {
            return Response::html($view->render('pages/auth_login', [
                'error' => 'No fue posible iniciar sesión.',
                'success' => null,
                'csrf' => Csrf::token(),
            ]), 500);
        }
    }

    public function showHospitalPasswordSetup(Request $request, Db $db, View $view, array $config): Response
    {
        if (!$this->isSetupAllowed($request, $config)) {
            return Response::html($view->render('pages/error_404', ['path' => $request->path]), 404);
        }

        return Response::html($view->render('pages/auth_hospital_password_setup', [
            'error' => Session::pull('error', null),
            'success' => Session::pull('success', null),
            'csrf' => Csrf::token(),
            'token' => (string)($request->query['token'] ?? ''),
        ]));
    }

    public function setHospitalPassword(Request $request, Db $db, View $view, array $config): Response
    {
        if (!$this->isSetupAllowed($request, $config)) {
            return Response::html($view->render('pages/error_404', ['path' => $request->path]), 404);
        }

        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            Session::flash('error', 'Solicitud inválida.');
            return Response::redirect('/setup/hospital-password' . $this->tokenQuery($request));
        }

        $email = strtolower(trim((string)($request->post['email'] ?? '')));
        $password = (string)($request->post['password'] ?? '');
        $confirm = (string)($request->post['confirm_password'] ?? '');

        if ($email === '' || $password === '' || $confirm === '') {
            Session::flash('error', 'Correo y contraseñas son requeridos.');
            return Response::redirect('/setup/hospital-password' . $this->tokenQuery($request));
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Session::flash('error', 'Correo inválido.');
            return Response::redirect('/setup/hospital-password' . $this->tokenQuery($request));
        }
        if ($password !== $confirm) {
            Session::flash('error', 'Las contraseñas no coinciden.');
            return Response::redirect('/setup/hospital-password' . $this->tokenQuery($request));
        }
        if (strlen($password) < 8) {
            Session::flash('error', 'La contraseña debe tener al menos 8 caracteres.');
            return Response::redirect('/setup/hospital-password' . $this->tokenQuery($request));
        }
        if (strlen($password) > 72) {
            Session::flash('error', 'La contraseña es demasiado larga.');
            return Response::redirect('/setup/hospital-password' . $this->tokenQuery($request));
        }

        $row = $this->fetchHospitalByEmail($db, $email);
        if (!$row) {
            Session::flash('error', 'No se encontró el hospital o falta configuración de autenticación.');
            return Response::redirect('/setup/hospital-password' . $this->tokenQuery($request));
        }
        if (is_array($row) && ($row['_password_hash_missing'] ?? false) === true) {
            Session::flash('error', 'Falta la columna hospitals.password_hash. Ejecute php-ssr/sql/sadi_auth_setup.sql si desea usar este flujo.');
            return Response::redirect('/setup/hospital-password' . $this->tokenQuery($request));
        }

        $newHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        try {
            $db->execute('UPDATE public.hospitals SET password_hash = :hash WHERE hospital_id = :id', [
                'hash' => $newHash,
                'id' => $row['hospital_id'],
            ]);
        } catch (\Throwable $e) {
            Session::flash('error', 'No fue posible configurar la contraseña.');
            return Response::redirect('/setup/hospital-password' . $this->tokenQuery($request));
        }

        Session::flash('success', 'Contraseña configurada. Ya puedes iniciar sesión.');
        return Response::redirect('/login');
    }

    public function showDoctorLogin(Request $request, Db $db, View $view, array $config): Response
    {
        if (Auth::check()) {
            $role = Auth::role();
            if ($role === 'doctor') return Response::redirect('/doctor/dashboard');
            if ($role === 'patient') return Response::redirect('/patient/dashboard');
            return Response::redirect('/dashboard');
        }

        return Response::html($view->render('pages/auth_doctor_login', [
            'error' => Session::pull('error', null),
            'csrf' => Csrf::token(),
        ]));
    }

    public function loginDoctor(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::html($view->render('pages/auth_doctor_login', [
                'error' => 'Solicitud inválida.',
                'csrf' => Csrf::token(),
            ]), 419);
        }

        $email = strtolower(trim((string)($request->post['email'] ?? '')));
        $password = (string)($request->post['password'] ?? '');

        if ($email === '' || $password === '') {
            return Response::html($view->render('pages/auth_doctor_login', [
                'error' => 'Correo y contraseña son requeridos.',
                'csrf' => Csrf::token(),
            ]), 422);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return Response::html($view->render('pages/auth_doctor_login', [
                'error' => 'Correo inválido.',
                'csrf' => Csrf::token(),
            ]), 422);
        }

        try {
            try {
                $row = $db->fetchOne(
                    'SELECT doctor_id, doctor_name, doctor_email, doctor_password, doctor_specialty, hospital_id, is_active
                     FROM public.staff
                     WHERE lower(doctor_email) = lower(:email)
                     LIMIT 1',
                    ['email' => $email]
                );
            } catch (\Throwable $e) {
                $msg = strtolower((string)$e->getMessage());
                if (str_contains($msg, 'doctor_password') && str_contains($msg, 'does not exist')) {
                    return Response::html($view->render('pages/auth_doctor_login', [
                        'error' => 'Falta la columna staff.doctor_password para autenticar doctores.',
                        'csrf' => Csrf::token(),
                    ]), 501);
                }
                throw $e;
            }

            if (!$row) {
                return Response::html($view->render('pages/auth_doctor_login', [
                    'error' => 'Credenciales inválidas.',
                    'csrf' => Csrf::token(),
                ]), 401);
            }

            if (($row['is_active'] ?? true) === false) {
                return Response::html($view->render('pages/auth_doctor_login', [
                    'error' => 'Doctor inactivo.',
                    'csrf' => Csrf::token(),
                ]), 403);
            }

            $stored = (string)($row['doctor_password'] ?? '');
            if ($stored === '') {
                return Response::html($view->render('pages/auth_doctor_login', [
                    'error' => 'El doctor no tiene contraseña configurada.',
                    'csrf' => Csrf::token(),
                ]), 401);
            }

            if (!$this->verifyPassword($password, $stored)) {
                return Response::html($view->render('pages/auth_doctor_login', [
                    'error' => 'Credenciales inválidas.',
                    'csrf' => Csrf::token(),
                ]), 401);
            }

            if (!$this->isHash($stored)) {
                $newHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
                $db->execute('UPDATE public.staff SET doctor_password = :hash WHERE doctor_id = :id', [
                    'hash' => $newHash,
                    'id' => $row['doctor_id'],
                ]);
            }

            Auth::login([
                'role' => 'doctor',
                'user_id' => $row['doctor_id'],
                'doctor_id' => $row['doctor_id'],
                'hospital_id' => $row['hospital_id'] ?? null,
                'email' => $row['doctor_email'],
                'name' => $row['doctor_name'] ?? $row['doctor_email'],
                'doctor_specialty' => $row['doctor_specialty'] ?? null,
            ]);

            return Response::redirect('/doctor/dashboard');
        } catch (\Throwable $e) {
            return Response::html($view->render('pages/auth_doctor_login', [
                'error' => 'No fue posible iniciar sesión.',
                'csrf' => Csrf::token(),
            ]), 500);
        }
    }

    public function showPatientLogin(Request $request, Db $db, View $view, array $config): Response
    {
        if (Auth::check()) {
            $role = Auth::role();
            if ($role === 'doctor') return Response::redirect('/doctor/dashboard');
            if ($role === 'patient') return Response::redirect('/patient/dashboard');
            return Response::redirect('/dashboard');
        }

        return Response::html($view->render('pages/auth_patient_login', [
            'error' => Session::pull('error', null),
            'csrf' => Csrf::token(),
        ]));
    }

    public function loginPatient(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::html($view->render('pages/auth_patient_login', [
                'error' => 'Solicitud inválida.',
                'csrf' => Csrf::token(),
            ]), 419);
        }

        $identifier = trim((string)($request->post['identifier'] ?? ''));
        $password = (string)($request->post['password'] ?? '');

        if ($identifier === '' || $password === '') {
            return Response::html($view->render('pages/auth_patient_login', [
                'error' => 'Documento/correo y contraseña son requeridos.',
                'csrf' => Csrf::token(),
            ]), 422);
        }

        try {
            $isEmail = str_contains($identifier, '@');
            try {
                $row = $db->fetchOne(
                    $isEmail
                        ? 'SELECT patient_id, name, email, document, hospital_id, password_hash
                           FROM public.patients
                           WHERE lower(email) = lower(:identifier)
                           LIMIT 1'
                        : 'SELECT patient_id, name, email, document, hospital_id, password_hash
                           FROM public.patients
                           WHERE document = :identifier
                           LIMIT 1',
                    ['identifier' => $isEmail ? strtolower($identifier) : $identifier]
                );
            } catch (\Throwable $e) {
                $msg = strtolower((string)$e->getMessage());
                if (str_contains($msg, 'password_hash') && str_contains($msg, 'does not exist')) {
                    return Response::html($view->render('pages/auth_patient_login', [
                        'error' => 'Falta la columna patients.password_hash para autenticar pacientes.',
                        'csrf' => Csrf::token(),
                    ]), 501);
                }
                throw $e;
            }

            if (!$row) {
                return Response::html($view->render('pages/auth_patient_login', [
                    'error' => 'Credenciales inválidas.',
                    'csrf' => Csrf::token(),
                ]), 401);
            }

            $stored = $row['password_hash'] ?? null;
            if (!is_string($stored) || $stored === '') {
                return Response::html($view->render('pages/auth_patient_login', [
                    'error' => 'El paciente no tiene contraseña configurada.',
                    'csrf' => Csrf::token(),
                ]), 401);
            }

            if (!$this->verifyPassword($password, $stored)) {
                return Response::html($view->render('pages/auth_patient_login', [
                    'error' => 'Credenciales inválidas.',
                    'csrf' => Csrf::token(),
                ]), 401);
            }

            if (!$this->isHash($stored)) {
                $newHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
                $db->execute('UPDATE public.patients SET password_hash = :hash WHERE patient_id = :id', [
                    'hash' => $newHash,
                    'id' => $row['patient_id'],
                ]);
            }

            Auth::login([
                'role' => 'patient',
                'user_id' => $row['patient_id'],
                'patient_id' => $row['patient_id'],
                'hospital_id' => $row['hospital_id'] ?? null,
                'email' => $row['email'] ?? null,
                'name' => $row['name'] ?? ($row['email'] ?? 'Paciente'),
                'document' => $row['document'] ?? null,
            ]);

            return Response::redirect('/patient/dashboard');
        } catch (\Throwable $e) {
            return Response::html($view->render('pages/auth_patient_login', [
                'error' => 'No fue posible iniciar sesión.',
                'csrf' => Csrf::token(),
            ]), 500);
        }
    }

    public function logout(Request $request, Db $db, View $view, array $config): Response
    {
        if (!Csrf::verify($request->post['_csrf'] ?? null)) {
            return Response::redirect('/login');
        }

        $role = Auth::role() ?? '';
        Auth::logout();
        Session::destroy();
        if ($role === 'doctor') return Response::redirect('/doctor/login');
        if ($role === 'patient') return Response::redirect('/patient/login');
        return Response::redirect('/login');
    }

    private function fetchHospitalByEmail(Db $db, string $email): ?array
    {
        try {
            return $db->fetchOne(
                'SELECT hospital_id, email, name, password_hash
                 FROM public.hospitals
                 WHERE lower(email) = lower(:email)
                 LIMIT 1',
                ['email' => $email]
            );
        } catch (\Throwable $e) {
            $msg = strtolower((string)$e->getMessage());
            if (str_contains($msg, 'password_hash') && str_contains($msg, 'does not exist')) {
                $row = $db->fetchOne(
                    'SELECT hospital_id, email, name
                     FROM public.hospitals
                     WHERE lower(email) = lower(:email)
                     LIMIT 1',
                    ['email' => $email]
                );
                if (is_array($row)) {
                    $row['_password_hash_missing'] = true;
                    $row['password_hash'] = null;
                }
                return $row;
            }
            return null;
        }
    }

    private function supabasePasswordSignIn(array $config, string $email, string $password): array
    {
        $url = trim((string)($config['supabase']['url'] ?? ''));
        $key = trim((string)($config['supabase']['anon_key'] ?? ''));
        if ($url === '' || $key === '') {
            return ['used' => false];
        }

        $endpoint = rtrim($url, '/') . '/auth/v1/token?grant_type=password';
        $body = json_encode(['email' => $email, 'password' => $password], JSON_UNESCAPED_SLASHES);
        if (!is_string($body)) {
            return ['used' => true, 'success' => false, 'error' => 'No fue posible autenticar.'];
        }

        $headers = [
            'Content-Type: application/json',
            'apikey: ' . $key,
            'Authorization: Bearer ' . $key,
        ];

        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headers),
                'content' => $body,
                'ignore_errors' => true,
                'timeout' => 12,
            ],
        ]);

        $resp = @file_get_contents($endpoint, false, $context);
        $status = 0;
        if (isset($http_response_header) && is_array($http_response_header) && isset($http_response_header[0])) {
            if (preg_match('#HTTP/\\S+\\s+(\\d{3})#', (string)$http_response_header[0], $m)) {
                $status = (int)$m[1];
            }
        }

        $data = null;
        if (is_string($resp) && $resp !== '') {
            $decoded = json_decode($resp, true);
            if (is_array($decoded)) {
                $data = $decoded;
            }
        }

        if ($status >= 200 && $status < 300 && is_array($data)) {
            return ['used' => true, 'success' => true, 'data' => $data];
        }

        $msg =
            (is_array($data) ? (string)($data['error_description'] ?? $data['msg'] ?? $data['message'] ?? $data['error'] ?? '') : '');
        if (trim($msg) === '') {
            $msg = 'Contraseña incorrecta o cuenta no verificada';
        }

        return ['used' => true, 'success' => false, 'status' => $status, 'error' => $msg];
    }

    private function isHash(string $stored): bool
    {
        return str_starts_with($stored, '$2y$') || str_starts_with($stored, '$2a$') || str_starts_with($stored, '$argon2');
    }

    private function verifyPassword(string $password, string $stored): bool
    {
        if ($this->isHash($stored)) {
            return password_verify($password, $stored);
        }
        return hash_equals($stored, $password);
    }

    private function isSetupAllowed(Request $request, array $config): bool
    {
        $token = trim((string)($config['app']['setup_token'] ?? ''));
        $remote = (string)($request->server['REMOTE_ADDR'] ?? '');
        $isLocal = ($remote === '127.0.0.1' || $remote === '::1');

        if ($token === '') {
            return $isLocal;
        }

        $provided = (string)($request->query['token'] ?? ($request->post['token'] ?? ''));
        return $provided !== '' && hash_equals($token, $provided);
    }

    private function tokenQuery(Request $request): string
    {
        $t = (string)($request->post['token'] ?? ($request->query['token'] ?? ''));
        if ($t === '') return '';
        return '?token=' . rawurlencode($t);
    }
}
