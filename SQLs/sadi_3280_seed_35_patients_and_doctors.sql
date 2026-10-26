-- ==============================================================================
-- SADI 3280: SEMILLAS COMPLETAS (35 PACIENTES REALES, 8 DOCTORES ESPECIALISTAS E HISTORIAS CLÍNICAS)
-- 5 Pacientes para cada Curso de Vida y Ruta Materno Perinatal
-- ==============================================================================

-- 1. CREACIÓN DE 8 DOCTORES ESPECIALISTAS (UNO POR CADA ÁREA CLÍNICA)
INSERT INTO public.staff (doctor_id, name, email, specialty, is_active)
VALUES
('d1111111-1111-1111-1111-111111111111', 'Dra. Paola Andrea Gil Restrepo', 'paola.gil@sadi.med.co', 'Pediatría y Puericultura (Primera Infancia e Infancia)', TRUE),
('d2222222-2222-2222-2222-222222222222', 'Dr. Juan Camilo Bermúdez Orozco', 'juan.bermudez@sadi.med.co', 'Medicina Familiar y Hebiatría (Adolescencia)', TRUE),
('d3333333-3333-3333-3333-333333333333', 'Dra. Sandra Milena Castaño Ríos', 'sandra.castano@sadi.med.co', 'Medicina General y Salud Sexual / Reproductiva (Juventud)', TRUE),
('d4444444-4444-4444-4444-444444444444', 'Dr. Fernando Rincón Velásquez', 'fernando.rincon@sadi.med.co', 'Medicina Interna y Riesgo Cardiovascular (Adultez)', TRUE),
('d5555555-5555-5555-5555-555555555555', 'Dra. Beatriz Elena Arango Salazar', 'beatriz.arango@sadi.med.co', 'Geriatría y Envejecimiento Activo (Vejez)', TRUE),
('d6666666-6666-6666-6666-666666666666', 'Dr. Mauricio Villa Cardona', 'mauricio.villa@sadi.med.co', 'Ginecobstetricia y Medicina Materno Fetal (RIAMP)', TRUE),
('d7777777-7777-7777-7777-777777777777', 'Dra. Natalia Ocampo Henao', 'natalia.ocampo@sadi.med.co', 'Odontología Integral y Salud Oral 3280', TRUE),
('d8888888-8888-8888-8888-888888888888', 'Dr. Carlos Eduardo Salazar Montoya', 'carlos.salazar@sadi.med.co', 'Oncología Clínica y Detección Temprana (Cáncer 3280)', TRUE)
ON CONFLICT (doctor_id) DO UPDATE SET
  name = EXCLUDED.name,
  specialty = EXCLUDED.specialty;

INSERT INTO public.doctors (id, doctor_id)
VALUES
(gen_random_uuid(), 'd1111111-1111-1111-1111-111111111111'),
(gen_random_uuid(), 'd2222222-2222-2222-2222-222222222222'),
(gen_random_uuid(), 'd3333333-3333-3333-3333-333333333333'),
(gen_random_uuid(), 'd4444444-4444-4444-4444-444444444444'),
(gen_random_uuid(), 'd5555555-5555-5555-5555-555555555555'),
(gen_random_uuid(), 'd6666666-6666-6666-6666-666666666666'),
(gen_random_uuid(), 'd7777777-7777-7777-7777-777777777777'),
(gen_random_uuid(), 'd8888888-8888-8888-8888-888888888888')
ON CONFLICT (doctor_id) DO NOTHING;

-- 2. CREACIÓN DE 35 PACIENTES REALES (5 POR CADA CURSO DE VIDA Y GESTACIÓN)

-- CASO 1: PRIMERA INFANCIA (0 A 5 AÑOS)
INSERT INTO public.patients (patient_id, name, document, phone, email, birth_date, gender, is_active)
VALUES
('p1010000-0000-0000-0000-000000000001', 'Luciana Ospina Castro', '1198450123', '+573104567801', 'madre.luciana@gmail.com', '2026-07-15', 'femenino', TRUE),
('p1010000-0000-0000-0000-000000000002', 'Mateo Benítez Valencia', '1198345091', '+573186671122', 'madre.mateo@gmail.com', '2025-11-20', 'masculino', TRUE),
('p1010000-0000-0000-0000-000000000003', 'Salomé Caicedo Mejía', '1197892341', '+573153344503', 'padres.salome@gmail.com', '2024-04-10', 'femenino', TRUE),
('p1010000-0000-0000-0000-000000000004', 'Samuel David Rengifo Morales', '1196781294', '+573128899104', 'familia.rengifo@gmail.com', '2023-01-25', 'masculino', TRUE),
('p1010000-0000-0000-0000-000000000005', 'Valeria Jaramillo Duque', '1195670185', '+573017788205', 'madre.valeria@gmail.com', '2022-03-14', 'femenino', TRUE)
ON CONFLICT (patient_id) DO UPDATE SET name = EXCLUDED.name, birth_date = EXCLUDED.birth_date;

-- CASO 2: INFANCIA (6 A 11 AÑOS)
INSERT INTO public.patients (patient_id, name, document, phone, email, birth_date, gender, is_active)
VALUES
('p2020000-0000-0000-0000-000000000006', 'Dylan Santiago Pardo Ruiz', '1098234561', '+573142233406', 'madre.dylan@gmail.com', '2020-09-12', 'masculino', TRUE),
('p2020000-0000-0000-0000-000000000007', 'Isabella Gómez Restrepo', '1097345672', '+573205566707', 'acudiente.isabella@gmail.com', '2018-05-30', 'femenino', TRUE),
('p2020000-0000-0000-0000-000000000008', 'Jerónimo Londoño Zapata', '1096456783', '+573116677808', 'familia.londono@gmail.com', '2017-08-18', 'masculino', TRUE),
('p2020000-0000-0000-0000-000000000009', 'Mariana Duque Cárdenas', '1095567894', '+573178899009', 'padres.mariana@gmail.com', '2016-02-14', 'femenino', TRUE),
('p2020000-0000-0000-0000-000000000010', 'Emmanuel Vargas Arias', '1094678905', '+573199900110', 'madre.emmanuel@gmail.com', '2015-10-05', 'masculino', TRUE)
ON CONFLICT (patient_id) DO UPDATE SET name = EXCLUDED.name, birth_date = EXCLUDED.birth_date;

-- CASO 3: ADOLESCENCIA (12 A 17 AÑOS)
INSERT INTO public.patients (patient_id, name, document, phone, email, birth_date, gender, is_active)
VALUES
('p3030000-0000-0000-0000-000000000011', 'Juan José Morales Marín', '1088123451', '+573133344511', 'juanjose.morales@gmail.com', '2013-11-04', 'masculino', TRUE),
('p3030000-0000-0000-0000-000000000012', 'Sofía Restrepo Cardona', '1087234562', '+573004455612', 'sofia.restrepo.c@gmail.com', '2012-07-22', 'femenino', TRUE),
('p3030000-0000-0000-0000-000000000013', 'Tomás Quintero Gallego', '1086345673', '+573165566713', 'tomas.quintero@gmail.com', '2011-03-15', 'masculino', TRUE),
('p3030000-0000-0000-0000-000000000014', 'Camila Andrea Rojas Bernal', '1085456784', '+573216677814', 'camila.rojas.b@gmail.com', '2010-09-08', 'femenino', TRUE),
('p3030000-0000-0000-0000-000000000015', 'Sebastián Beltrán Muñoz', '1084567895', '+573157788915', 'sebastian.beltran@gmail.com', '2009-01-19', 'masculino', TRUE)
ON CONFLICT (patient_id) DO UPDATE SET name = EXCLUDED.name, birth_date = EXCLUDED.birth_date;

-- CASO 4: JUVENTUD (18 A 28 AÑOS)
INSERT INTO public.patients (patient_id, name, document, phone, email, birth_date, gender, is_active)
VALUES
('p4040000-0000-0000-0000-000000000016', 'Andrea Paola Mendoza Cruz', '1053123451', '+573101122316', 'andrea.mendoza@gmail.com', '2007-06-14', 'femenino', TRUE),
('p4040000-0000-0000-0000-000000000017', 'Daniel Esteban Ruiz Ocampo', '1052234562', '+573022233417', 'daniel.esteban.r@gmail.com', '2005-02-28', 'masculino', TRUE),
('p4040000-0000-0000-0000-000000000018', 'Daniela Henao Betancur', '1051345673', '+573143344518', 'daniela.henao.b@gmail.com', '2003-12-05', 'femenino', TRUE),
('p4040000-0000-0000-0000-000000000019', 'Nicolás Cárdenas Sierra', '1050456784', '+573184455619', 'nicolas.cardenas@gmail.com', '2001-08-17', 'masculino', TRUE),
('p4040000-0000-0000-0000-000000000020', 'Laura Valentina Soto Silva', '1049567895', '+573225566720', 'laura.val.soto@gmail.com', '1999-04-23', 'femenino', TRUE)
ON CONFLICT (patient_id) DO UPDATE SET name = EXCLUDED.name, birth_date = EXCLUDED.birth_date;

-- CASO 5: ADULTEZ (29 A 59 AÑOS)
INSERT INTO public.patients (patient_id, name, document, phone, email, birth_date, gender, is_active)
VALUES
('p5050000-0000-0000-0000-000000000021', 'Carlos Alberto Gómez Pineda', '71349821', '+573019876543', 'carlos.gomez@gmail.com', '1968-11-20', 'masculino', TRUE),
('p5050000-0000-0000-0000-000000000022', 'Claudia Patricia Osorio Ríos', '43567892', '+573112233422', 'claudia.osorio@gmail.com', '1984-07-11', 'femenino', TRUE),
('p5050000-0000-0000-0000-000000000023', 'Jorge Eliécer Mejía Tabares', '10234567', '+573153344523', 'jorge.mejia.t@gmail.com', '1974-03-29', 'masculino', TRUE),
('p5050000-0000-0000-0000-000000000024', 'Diana Marcela Toro Agudelo', '32456789', '+573174455624', 'diana.toro@gmail.com', '1992-10-15', 'femenino', TRUE),
('p5050000-0000-0000-0000-000000000025', 'Ricardo Antonio Marín Serna', '98567123', '+573195566725', 'ricardo.marin@gmail.com', '1978-01-08', 'masculino', TRUE)
ON CONFLICT (patient_id) DO UPDATE SET name = EXCLUDED.name, birth_date = EXCLUDED.birth_date;

-- CASO 6: VEJEZ (60+ AÑOS)
INSERT INTO public.patients (patient_id, name, document, phone, email, birth_date, gender, is_active)
VALUES
('p6060000-0000-0000-0000-000000000026', 'Esperanza Duarte de Castro', '28493012', '+573152239988', 'esperanza.duarte@gmail.com', '1952-03-08', 'femenino', TRUE),
('p6060000-0000-0000-0000-000000000027', 'Bernardo de Jesús Hoyos Flórez', '4321987', '+573103344527', 'bernardo.hoyos@gmail.com', '1958-09-24', 'masculino', TRUE),
('p6060000-0000-0000-0000-000000000028', 'Cecilia Echeverri de Ramírez', '24567812', '+573124455628', 'cecilia.echeverri@gmail.com', '1954-12-16', 'femenino', TRUE),
('p6060000-0000-0000-0000-000000000029', 'Humberto Zuluaga Rendón', '3890123', '+573165566729', 'humberto.zuluaga@gmail.com', '1945-05-02', 'masculino', TRUE),
('p6060000-0000-0000-0000-000000000030', 'Teresa de Jesús Correa Soto', '21345678', '+573206677830', 'teresa.correa@gmail.com', '1961-08-31', 'femenino', TRUE)
ON CONFLICT (patient_id) DO UPDATE SET name = EXCLUDED.name, birth_date = EXCLUDED.birth_date;

-- CASO 7: RUTA MATERNO PERINATAL (RIAMP - GESTANTES Y PUÉRPERAS)
INSERT INTO public.patients (patient_id, name, document, phone, email, birth_date, gender, is_active)
VALUES
('p7070000-0000-0000-0000-000000000031', 'Valentina Restrepo Morales', '1020485923', '+573124567890', 'valentina.restrepo@gmail.com', '1998-05-14', 'femenino', TRUE),
('p7070000-0000-0000-0000-000000000032', 'Yuliana Marcela Cardona Vélez', '1017894561', '+573147788932', 'yuliana.cardona@gmail.com', '2002-09-03', 'femenino', TRUE),
('p7070000-0000-0000-0000-000000000033', 'Manuela Cardona Hincapié', '1036456782', '+573018899033', 'manuela.cardona@gmail.com', '1995-11-27', 'femenino', TRUE),
('p7070000-0000-0000-0000-000000000034', 'Estefanía Arias Quintero', '1054321983', '+573189900134', 'estefania.arias@gmail.com', '1993-02-18', 'femenino', TRUE),
('p7070000-0000-0000-0000-000000000035', 'Marcela Cano Castañeda', '1024567894', '+573221122335', 'marcela.cano@gmail.com', '1997-06-09', 'femenino', TRUE)
ON CONFLICT (patient_id) DO UPDATE SET name = EXCLUDED.name, birth_date = EXCLUDED.birth_date;

-- 3. VINCULACIÓN DE PERFILES 3280 Y ASIGNACIÓN A DOCTORES ESPECIALISTAS
INSERT INTO public.patient_profiles_3280 (patient_id, curso_vida, es_gestante, semana_gestacional, es_hipertenso, es_diabetico, canal_preferido, dispositivos_caseros)
VALUES
-- Primera Infancia -> Dra. Paola Gil (Pediatría)
('p1010000-0000-0000-0000-000000000001', 'primera_infancia', FALSE, NULL, FALSE, FALSE, 'whatsapp', ARRAY['termometro_infrarrojo']),
('p1010000-0000-0000-0000-000000000002', 'primera_infancia', FALSE, NULL, FALSE, FALSE, 'call_ia', ARRAY['termometro_infrarrojo', 'pesa_bebe']),
('p1010000-0000-0000-0000-000000000003', 'primera_infancia', FALSE, NULL, FALSE, FALSE, 'whatsapp', ARRAY['termometro_infrarrojo']),
('p1010000-0000-0000-0000-000000000004', 'primera_infancia', FALSE, NULL, FALSE, FALSE, 'sms', ARRAY['termometro_infrarrojo']),
('p1010000-0000-0000-0000-000000000005', 'primera_infancia', FALSE, NULL, FALSE, FALSE, 'call_ia', ARRAY['termometro_infrarrojo']),

-- Infancia -> Dra. Paola Gil / Dra. Natalia Ocampo (Bucal)
('p2020000-0000-0000-0000-000000000006', 'infancia', FALSE, NULL, FALSE, FALSE, 'call_ia', ARRAY['bascula_digital']),
('p2020000-0000-0000-0000-000000000007', 'infancia', FALSE, NULL, FALSE, FALSE, 'whatsapp', ARRAY['bascula_digital']),
('p2020000-0000-0000-0000-000000000008', 'infancia', FALSE, NULL, FALSE, FALSE, 'sms', ARRAY['bascula_digital']),
('p2020000-0000-0000-0000-000000000009', 'infancia', FALSE, NULL, FALSE, FALSE, 'call_ia', ARRAY['bascula_digital']),
('p2020000-0000-0000-0000-000000000010', 'infancia', FALSE, NULL, FALSE, FALSE, 'whatsapp', ARRAY['bascula_digital']),

-- Adolescencia -> Dr. Juan Camilo Bermúdez (Medicina Familiar & Hebiatría)
('p3030000-0000-0000-0000-000000000011', 'adolescencia', FALSE, NULL, FALSE, FALSE, 'whatsapp', ARRAY['tensiometro']),
('p3030000-0000-0000-0000-000000000012', 'adolescencia', FALSE, NULL, FALSE, FALSE, 'call_ia', ARRAY['tensiometro', 'bascula_digital']),
('p3030000-0000-0000-0000-000000000013', 'adolescencia', FALSE, NULL, FALSE, FALSE, 'sms', ARRAY['tensiometro']),
('p3030000-0000-0000-0000-000000000014', 'adolescencia', FALSE, NULL, FALSE, FALSE, 'whatsapp', ARRAY['tensiometro']),
('p3030000-0000-0000-0000-000000000015', 'adolescencia', FALSE, NULL, FALSE, FALSE, 'call_ia', ARRAY['tensiometro']),

-- Juventud -> Dra. Sandra Milena Castaño (Salud Sexual / Reproductiva)
('p4040000-0000-0000-0000-000000000016', 'juventud', FALSE, NULL, FALSE, FALSE, 'whatsapp', ARRAY['tensiometro']),
('p4040000-0000-0000-0000-000000000017', 'juventud', FALSE, NULL, FALSE, FALSE, 'sms', ARRAY['tensiometro']),
('p4040000-0000-0000-0000-000000000018', 'juventud', FALSE, NULL, FALSE, FALSE, 'call_ia', ARRAY['tensiometro', 'bascula_digital']),
('p4040000-0000-0000-0000-000000000019', 'juventud', FALSE, NULL, FALSE, FALSE, 'whatsapp', ARRAY['tensiometro']),
('p4040000-0000-0000-0000-000000000020', 'juventud', FALSE, NULL, FALSE, FALSE, 'call_ia', ARRAY['tensiometro']),

-- Adultez -> Dr. Fernando Rincón (Medicina Interna) / Dr. Carlos Salazar (Oncología 3280)
('p5050000-0000-0000-0000-000000000021', 'adultez', FALSE, NULL, TRUE, TRUE, 'call_ia', ARRAY['tensiometro', 'glucometro']),
('p5050000-0000-0000-0000-000000000022', 'adultez', FALSE, NULL, FALSE, FALSE, 'whatsapp', ARRAY['tensiometro']),
('p5050000-0000-0000-0000-000000000023', 'adultez', FALSE, NULL, TRUE, FALSE, 'call_ia', ARRAY['tensiometro']),
('p5050000-0000-0000-0000-000000000024', 'adultez', FALSE, NULL, FALSE, FALSE, 'whatsapp', ARRAY['tensiometro']),
('p5050000-0000-0000-0000-000000000025', 'adultez', FALSE, NULL, TRUE, TRUE, 'sms', ARRAY['tensiometro', 'glucometro']),

-- Vejez -> Dra. Beatriz Arango (Geriatría)
('p6060000-0000-0000-0000-000000000026', 'vejez', FALSE, NULL, TRUE, FALSE, 'call_ia', ARRAY['tensiometro', 'oximetro']),
('p6060000-0000-0000-0000-000000000027', 'vejez', FALSE, NULL, TRUE, TRUE, 'call_ia', ARRAY['tensiometro', 'glucometro']),
('p6060000-0000-0000-0000-000000000028', 'vejez', FALSE, NULL, FALSE, FALSE, 'whatsapp', ARRAY['tensiometro', 'oximetro']),
('p6060000-0000-0000-0000-000000000029', 'vejez', FALSE, NULL, TRUE, FALSE, 'call_ia', ARRAY['tensiometro']),
('p6060000-0000-0000-0000-000000000030', 'vejez', FALSE, NULL, FALSE, FALSE, 'whatsapp', ARRAY['tensiometro']),

-- Ruta Materno Perinatal -> Dr. Mauricio Villa (Ginecobstetricia)
('p7070000-0000-0000-0000-000000000031', 'adultez', TRUE, 28, TRUE, FALSE, 'call_ia', ARRAY['tensiometro_digital', 'bascula_digital']),
('p7070000-0000-0000-0000-000000000032', 'juventud', TRUE, 12, FALSE, FALSE, 'whatsapp', ARRAY['tensiometro_digital']),
('p7070000-0000-0000-0000-000000000033', 'adultez', TRUE, 21, FALSE, FALSE, 'call_ia', ARRAY['tensiometro_digital']),
('p7070000-0000-0000-0000-000000000034', 'adultez', TRUE, 36, FALSE, FALSE, 'call_ia', ARRAY['tensiometro_digital']),
('p7070000-0000-0000-0000-000000000035', 'adultez', TRUE, 0, FALSE, FALSE, 'whatsapp', ARRAY['tensiometro_digital', 'termometro_infrarrojo'])
ON CONFLICT (patient_id) DO UPDATE SET
  es_gestante = EXCLUDED.es_gestante,
  semana_gestacional = EXCLUDED.semana_gestacional;

-- 4. DOCUMENTOS DE HISTORIAS CLÍNICAS DISTRIBUIDOS RIGUROSAMENTE EN CARPETAS
INSERT INTO public.patient_clinical_documents (patient_id, doctor_id, nombre_archivo, carpeta_clasificada, ruta_almacenamiento, tamano_bytes, tipo_mime, descripcion_clinica, subido_por_nombre)
VALUES
-- Valentina Restrepo (Gestante)
('p7070000-0000-0000-0000-000000000031', 'd6666666-6666-6666-6666-666666666666', 'ecografia_detalle_anatomico_sem21.pdf', 'PDF', 'HISTORIAS_CLINICAS/VALENTINA_RESTREPO/PDF/ecografia_detalle_anatomico_sem21.pdf', 3450200, 'application/pdf', 'Informe ecográfico estructural fetal sin malformaciones mayores', 'Dr. Mauricio Villa Cardona'),
('p7070000-0000-0000-0000-000000000031', 'd6666666-6666-6666-6666-666666666666', 'curva_monitoreo_tensional_semanal.xlsx', 'EXCEL', 'HISTORIAS_CLINICAS/VALENTINA_RESTREPO/EXCEL/curva_monitoreo_tensional_semanal.xlsx', 152400, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Registro de tensiometría domiciliaria con cálculo automático de PAM', 'Dr. Mauricio Villa Cardona'),
('p7070000-0000-0000-0000-000000000031', 'd6666666-6666-6666-6666-666666666666', 'epicrisis_control_obstetrico_alta_complejidad.docx', 'WORD', 'HISTORIAS_CLINICAS/VALENTINA_RESTREPO/WORD/epicrisis_control_obstetrico_alta_complejidad.docx', 84000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Nota clínica de manejo de hipertensión gestacional con sulfato de magnesio y alfametildopa', 'Dr. Mauricio Villa Cardona'),
('p7070000-0000-0000-0000-000000000031', 'd6666666-6666-6666-6666-666666666666', 'foto_doppler_arterias_uterinas.jpg', 'JPG/JPEG/PNG', 'HISTORIAS_CLINICAS/VALENTINA_RESTREPO/JPG/JPEG/PNG/foto_doppler_arterias_uterinas.jpg', 1890000, 'image/jpeg', 'Captura de espectro Doppler de arterias uterinas con notch bilateral', 'Dr. Mauricio Villa Cardona'),
('p7070000-0000-0000-0000-000000000031', 'd6666666-6666-6666-6666-666666666666', 'educacion_preeclampsia_curso_maternidad.pptx', 'POWERPOINT', 'HISTORIAS_CLINICAS/VALENTINA_RESTREPO/POWERPOINT/educacion_preeclampsia_curso_maternidad.pptx', 4500000, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'Diapositivas explicativas sobre signos de alarma obstétrica de la Res. 3280', 'Dr. Mauricio Villa Cardona'),
('p7070000-0000-0000-0000-000000000031', 'd6666666-6666-6666-6666-666666666666', 'tablero_analitico_riesgo_materno.pbix', 'POWER BI', 'HISTORIAS_CLINICAS/VALENTINA_RESTREPO/POWER BI/tablero_analitico_riesgo_materno.pbix', 8900000, 'application/octet-stream', 'Tablero dinámico de correlación de biomarcadores y evolución tensional', 'Dr. Mauricio Villa Cardona'),
('p7070000-0000-0000-0000-000000000031', 'd6666666-6666-6666-6666-666666666666', 'cronograma_atenciones_gestante_3280.mpp', 'PROJECT', 'HISTORIAS_CLINICAS/VALENTINA_RESTREPO/PROJECT/cronograma_atenciones_gestante_3280.mpp', 340000, 'application/vnd.ms-project', 'Línea de tiempo de paraclínicos trimestrales y controles prenatales', 'Dr. Mauricio Villa Cardona'),
('p7070000-0000-0000-0000-000000000031', 'd6666666-6666-6666-6666-666666666666', 'estudios_geneticos_completos_prenatales.zip', 'ZIP/RAR', 'HISTORIAS_CLINICAS/VALENTINA_RESTREPO/ZIP/RAR/estudios_geneticos_completos_prenatales.zip', 14500000, 'application/zip', 'Compilado de informes citogenéticos, ADN libre circulante y cariotipo', 'Dr. Mauricio Villa Cardona'),
('p7070000-0000-0000-0000-000000000031', 'd6666666-6666-6666-6666-666666666666', 'consentimiento_informado_parto_humanizado.odt', 'OTROS', 'HISTORIAS_CLINICAS/VALENTINA_RESTREPO/OTROS/consentimiento_informado_parto_humanizado.odt', 45000, 'application/vnd.oasis.opendocument.text', 'Consentimiento diligenciado y firmado para alumbramiento activo y acompañamiento', 'Dr. Mauricio Villa Cardona'),

-- Carlos Gómez (Adulto HTA + DM2)
('p5050000-0000-0000-0000-000000000021', 'd4444444-4444-4444-4444-444444444444', 'laboratorio_hemoglobina_glicosilada_perfil_lipidico.pdf', 'PDF', 'HISTORIAS_CLINICAS/CARLOS_GOMEZ/PDF/laboratorio_hemoglobina_glicosilada_perfil_lipidico.pdf', 890000, 'application/pdf', 'HbA1c 8.2%, Creatinina 1.1 mg/dL, Colesterol LDL 145 mg/dL', 'Dr. Fernando Rincón Velásquez'),
('p5050000-0000-0000-0000-000000000021', 'd4444444-4444-4444-4444-444444444444', 'registro_glucometrias_ambulatorias_30dias.xlsx', 'EXCEL', 'HISTORIAS_CLINICAS/CARLOS_GOMEZ/EXCEL/registro_glucometrias_ambulatorias_30dias.xlsx', 95000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Curva de glucemias en ayunas y postprandiales 2h con promedios', 'Dr. Fernando Rincón Velásquez'),
('p5050000-0000-0000-0000-000000000021', 'd4444444-4444-4444-4444-444444444444', 'plan_terapeutico_metformina_losartan.docx', 'WORD', 'HISTORIAS_CLINICAS/CARLOS_GOMEZ/WORD/plan_terapeutico_metformina_losartan.docx', 56000, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Reajuste farmacológico y pautas nutricionales de la Res. 3280', 'Dr. Fernando Rincón Velásquez'),
('p5050000-0000-0000-0000-000000000021', 'd4444444-4444-4444-4444-444444444444', 'electrocardiograma_12_derivaciones.jpg', 'JPG/JPEG/PNG', 'HISTORIAS_CLINICAS/CARLOS_GOMEZ/JPG/JPEG/PNG/electrocardiograma_12_derivaciones.jpg', 2100000, 'image/jpeg', 'Trazado de EKG con ritmo sinusal y signos de sobrecarga ventricular izquierda', 'Dr. Fernando Rincón Velásquez'),

-- Mateo Benítez (Primera Infancia)
('p1010000-0000-0000-0000-000000000002', 'd1111111-1111-1111-1111-111111111111', 'escala_abreviada_desarrollo_ead3_evaluacion.pdf', 'PDF', 'HISTORIAS_CLINICAS/MATEO_BENITEZ/PDF/escala_abreviada_desarrollo_ead3_evaluacion.pdf', 620000, 'application/pdf', 'Hoja de registro de EAD-3 con percentiles adecuados en las 4 áreas del desarrollo', 'Dra. Paola Andrea Gil Restrepo'),
('p1010000-0000-0000-0000-000000000002', 'd1111111-1111-1111-1111-111111111111', 'curva_crecimiento_oms_peso_talla.xlsx', 'EXCEL', 'HISTORIAS_CLINICAS/MATEO_BENITEZ/EXCEL/curva_crecimiento_oms_peso_talla.xlsx', 110000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Gráficos de Z-score para peso/edad y talla/edad', 'Dra. Paola Andrea Gil Restrepo');
