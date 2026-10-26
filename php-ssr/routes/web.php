<?php

declare(strict_types=1);

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PatientsController;
use App\Http\Controllers\CampaignsController;
use App\Http\Controllers\InteractionsController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DoctorsController;
use App\Http\Controllers\SegmentationController;
use App\Http\Controllers\TemplatesController;
use App\Http\Controllers\ReportsController;
use App\Http\Middleware\RequireRole;
use App\Support\Http\Response;

$auth = new AuthController();
$dashboard = new DashboardController();
$patients = new PatientsController();
$campaigns = new CampaignsController();
$interactions = new InteractionsController();
$doctors = new DoctorsController();
$segmentation = new SegmentationController();
$templates = new TemplatesController();
$reports = new ReportsController();

$router->get('/', static fn ($request, $db, $view, $config) => Response::redirect('/login'));

$router->get('/login', [$auth, 'showLogin']);
$router->post('/login', [$auth, 'login']);
$router->get('/register-hospital', static fn ($request, $db, $view, $config) => Response::redirect('/setup/hospital-password'));
$router->get('/setup/hospital-password', [$auth, 'showHospitalPasswordSetup']);
$router->post('/setup/hospital-password', [$auth, 'setHospitalPassword']);
$router->get('/doctor/login', [$auth, 'showDoctorLogin']);
$router->post('/doctor/login', [$auth, 'loginDoctor']);
$router->get('/patient/login', [$auth, 'showPatientLogin']);
$router->post('/patient/login', [$auth, 'loginPatient']);
$router->post('/logout', [$auth, 'logout'], [
    new RequireRole(['hospital_admin', 'doctor', 'patient'], '/login'),
]);

$router->get('/dashboard', [$dashboard, 'index'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/patients', [$patients, 'index'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/patients/create', [$patients, 'createForm'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/patients', [$patients, 'create'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/patients/{id}/edit', [$patients, 'editForm'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/patients/{id}', [$patients, 'update'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/doctors', [$doctors, 'index'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/doctors/create', [$doctors, 'createForm'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/doctors', [$doctors, 'create'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/doctors/{id}/edit', [$doctors, 'editForm'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/doctors/{id}', [$doctors, 'update'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/doctors/{id}/delete', [$doctors, 'delete'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/segmentation', [$segmentation, 'index'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/segmentation/create', [$segmentation, 'createForm'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/segmentation', [$segmentation, 'create'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/segmentation/{id}/edit', [$segmentation, 'editForm'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/segmentation/{id}', [$segmentation, 'update'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/segmentation/{id}/delete', [$segmentation, 'delete'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/templates', [$templates, 'index'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/templates/create', [$templates, 'createForm'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/templates', [$templates, 'create'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/templates/{id}/edit', [$templates, 'editForm'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/templates/{id}', [$templates, 'update'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/templates/{id}/delete', [$templates, 'delete'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/reports', [$reports, 'index'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/reports/export/{type}', [$reports, 'export'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/campaigns', [$campaigns, 'index'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/campaigns/create', [$campaigns, 'createForm'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/campaigns', [$campaigns, 'create'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/campaigns/{id}/edit', [$campaigns, 'editForm'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/campaigns/{id}', [$campaigns, 'update'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/interactions', [$interactions, 'index'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/interactions/create', [$interactions, 'createForm'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/interactions', [$interactions, 'create'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/interactions/{id}/edit', [$interactions, 'editForm'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->post('/interactions/{id}', [$interactions, 'update'], [
    new RequireRole(['hospital_admin'], '/login'),
]);

$router->get('/doctor/dashboard', [$dashboard, 'doctor'], [
    new RequireRole(['doctor'], '/doctor/login'),
]);

$router->get('/patient/dashboard', [$dashboard, 'patient'], [
    new RequireRole(['patient'], '/patient/login'),
]);

$router->get('/patient/health', [$dashboard, 'patientHealth'], [
    new RequireRole(['patient'], '/patient/login'),
]);

$router->post('/patient/health', [$dashboard, 'patientHealthSave'], [
    new RequireRole(['patient'], '/patient/login'),
]);

$router->get('/patient/programs', [$dashboard, 'patientPrograms'], [
    new RequireRole(['patient'], '/patient/login'),
]);

$router->get('/patient/history', [$dashboard, 'patientHistory'], [
    new RequireRole(['patient'], '/patient/login'),
]);

$router->get('/patient/history/{id}/download', [$dashboard, 'patientHistoryDownload'], [
    new RequireRole(['patient'], '/patient/login'),
]);

$router->get('/patient/interactions', [$dashboard, 'patientInteractions'], [
    new RequireRole(['patient'], '/patient/login'),
]);

$router->post('/patient/interactions', [$dashboard, 'patientInteractionsCreate'], [
    new RequireRole(['patient'], '/patient/login'),
]);

$router->get('/patient/schedule', [$dashboard, 'patientSchedule'], [
    new RequireRole(['patient'], '/patient/login'),
]);
