-- ==============================================================================
-- SADI: Migración Escalable (142,602+ pacientes) - Resolución 3280 de 2018
--   - 7 Cursos de Vida (A-G); H (Planificación), I (Vacunación PAI) y J (Salud Oral)
--     movidos a Grupos de Riesgo (11 cohortes reales, sin inventar riesgos)
--   - Multi-riesgo clínico real en public.patients.grupos_riesgo TEXT[]
--   - Capacidad operativa real: 500 llamadas IA/día (Lun-Sáb sin festivos Colombia)
--   - Prioridad P1-P5 (Tablero_SADI_Campanas) + derivación SMS respaldo (R1-04)
--   - Filtro de Ubicación DIVIPOLA Santiago de Cali (Urbano/Rural)
--   - Seguimiento automático a Inasistentes (+3 días SMS -> +2 días SMS + E-Mail)
-- ==============================================================================

-- 1. Columnas requeridas en public.patients
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS doctor_id UUID NULL REFERENCES public.staff(doctor_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS curso_vida VARCHAR(40),
  ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(10) DEFAULT 'CC',
  ADD COLUMN IF NOT EXISTS llave VARCHAR(40),
  ADD COLUMN IF NOT EXISTS eps VARCHAR(80),
  ADD COLUMN IF NOT EXISTS ips_asignada VARCHAR(120),
  ADD COLUMN IF NOT EXISTS grupos_riesgo TEXT[] NOT NULL DEFAULT '{}'::text[];

-- 2. Índices de alto rendimiento sobre 142k+ filas
CREATE INDEX IF NOT EXISTS patients_doctor_idx ON public.patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_hospital_doctor_id ON public.patients(hospital_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_hospital_curso_vida ON public.patients(hospital_id, curso_vida);
CREATE INDEX IF NOT EXISTS idx_patients_hospital_birthdate ON public.patients(hospital_id, birthdate);
CREATE INDEX IF NOT EXISTS idx_patients_hospital_grupo_riesgo ON public.patients(hospital_id, grupo_riesgo);
CREATE INDEX IF NOT EXISTS gin_patients_grupos_riesgo ON public.patients USING gin (grupos_riesgo);
CREATE INDEX IF NOT EXISTS idx_patients_hospital_geo ON public.patients(hospital_id, zona, comuna, barrio);
CREATE INDEX IF NOT EXISTS idx_patients_hosp_created_nl ON public.patients(hospital_id, created_at DESC NULLS LAST, patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_curso_sort ON public.patients(hospital_id, curso_vida, created_at DESC NULLS LAST, patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_doctor_sort ON public.patients(hospital_id, doctor_id, created_at DESC NULLS LAST, patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_demog ON public.patients(hospital_id, sex, birthdate);
CREATE INDEX IF NOT EXISTS idx_patients_reports_cover ON public.patients(hospital_id, curso_vida, grupo_riesgo, zona, comuna, barrio);
CREATE INDEX IF NOT EXISTS gin_patients_barrio_trgm ON public.patients USING gin (barrio gin_trgm_ops);
CREATE INDEX IF NOT EXISTS gin_patients_city_trgm ON public.patients USING gin (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS gin_patients_curso_trgm ON public.patients USING gin (curso_vida gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_hosp_id_keyset ON public.patients(hospital_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_hosp_tipo_usuario ON public.patients(hospital_id, tipo_usuario);
CREATE INDEX IF NOT EXISTS gin_patients_hc_trgm ON public.patients USING gin (historia_clinica_num gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_rural_geo ON public.patients(hospital_id, corregimiento, vereda, centro_poblado) WHERE zona = 'Rural';
CREATE INDEX IF NOT EXISTS idx_patients_cronograma_cover ON public.patients(hospital_id, curso_vida, grupo_riesgo, birthdate, program);
CREATE INDEX IF NOT EXISTS idx_patients_hosp_bmonth_curso ON public.patients(hospital_id, (COALESCE(EXTRACT(MONTH FROM birthdate)::INT, 1)), curso_vida);
CREATE INDEX IF NOT EXISTS idx_patients_demanda_day_sort ON public.patients (hospital_id, (LEAST(GREATEST(COALESCE(EXTRACT(DAY FROM birthdate)::INT, 1), 1), 28)), patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_nonzero_canales ON public.patients(hospital_id, curso_vida, grupo_riesgo, zona, comuna, barrio)
  WHERE ((conteo_canales->>'sms')::int > 0 OR (conteo_canales->>'email')::int > 0 OR (conteo_canales->>'call')::int > 0 OR (conteo_canales->>'whatsapp')::int > 0);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_llave_unique ON public.patients(llave) WHERE llave IS NOT NULL;

-- 3. Clasificación estricta por 7 Cursos de Vida (A - G, Res. 3280 de 2018)
--    H (Planificación Familiar), I (Vacunación PAI) y J (Salud Oral) pertenecen a Grupos de Riesgo.
CREATE OR REPLACE FUNCTION public.classify_curso_vida_3280(
  p_birthdate DATE,
  p_program TEXT DEFAULT NULL,
  p_curso_vida TEXT DEFAULT NULL
)
RETURNS VARCHAR
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_prog TEXT := lower(coalesce(p_program, ''));
  v_curso TEXT := lower(coalesce(p_curso_vida, ''));
  v_age INT;
BEGIN
  -- Curso G: Preventivo de la Mujer / Materno-Perinatal (RIAMP)
  IF v_curso ~ '(mujer|materno|gestan)' OR v_curso = 'g' OR v_curso IN ('preventivo_mujer', 'materno_perinatal')
     OR v_prog ~ '(embarazo|materno|gestan|preeclampsia|riamp|preventivo de la mujer)' THEN
    RETURN 'preventivo_mujer';
  END IF;

  -- Clasificación cronológica estricta por fecha de nacimiento (A - F)
  IF p_birthdate IS NOT NULL THEN
    v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, p_birthdate))::INT;
    IF v_age <= 5 THEN RETURN 'primera_infancia'; END IF;
    IF v_age <= 11 THEN RETURN 'infancia'; END IF;
    IF v_age <= 17 THEN RETURN 'adolescencia'; END IF;
    IF v_age <= 28 THEN RETURN 'juventud'; END IF;
    IF v_age <= 59 THEN RETURN 'adultez'; END IF;
    RETURN 'vejez';
  END IF;

  -- Respaldo por texto explícito de curso de vida (A - F)
  IF v_curso ~ 'primera' OR v_curso = 'a' THEN RETURN 'primera_infancia'; END IF;
  IF v_curso ~ 'infan' OR v_curso = 'b' THEN RETURN 'infancia'; END IF;
  IF v_curso ~ 'adolesc' OR v_curso = 'c' THEN RETURN 'adolescencia'; END IF;
  IF v_curso ~ 'juven' OR v_curso = 'd' THEN RETURN 'juventud'; END IF;
  IF v_curso ~ '(vej|mayor|geriatr)' OR v_curso = 'f' THEN RETURN 'vejez'; END IF;

  RETURN 'adultez';
END;
$$;

-- 3b. Helpers compartidos Res. 3280 (7 Cursos A..G y 11 Grupos de Riesgo reales 1..11, 0 = sin riesgo)
CREATE OR REPLACE FUNCTION public.curso_key_to_code_3280(p_curso TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(coalesce(p_curso, '')))
    WHEN 'primera_infancia' THEN 'A'
    WHEN 'a' THEN 'A'
    WHEN 'infancia' THEN 'B'
    WHEN 'b' THEN 'B'
    WHEN 'adolescencia' THEN 'C'
    WHEN 'c' THEN 'C'
    WHEN 'juventud' THEN 'D'
    WHEN 'd' THEN 'D'
    WHEN 'adultez' THEN 'E'
    WHEN 'e' THEN 'E'
    WHEN 'vejez' THEN 'F'
    WHEN 'f' THEN 'F'
    WHEN 'preventivo_mujer' THEN 'G'
    WHEN 'materno_perinatal' THEN 'G'
    WHEN 'g' THEN 'G'
    ELSE 'E'
  END;
$$;

CREATE OR REPLACE FUNCTION public.code_to_curso_keys_3280(p_code TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(trim(coalesce(p_code, '')))
    WHEN 'A' THEN ARRAY['primera_infancia']
    WHEN 'PRIMERA_INFANCIA' THEN ARRAY['primera_infancia']
    WHEN 'B' THEN ARRAY['infancia']
    WHEN 'INFANCIA' THEN ARRAY['infancia']
    WHEN 'C' THEN ARRAY['adolescencia']
    WHEN 'ADOLESCENCIA' THEN ARRAY['adolescencia']
    WHEN 'D' THEN ARRAY['juventud']
    WHEN 'JUVENTUD' THEN ARRAY['juventud']
    WHEN 'E' THEN ARRAY['adultez']
    WHEN 'ADULTEZ' THEN ARRAY['adultez']
    WHEN 'F' THEN ARRAY['vejez']
    WHEN 'VEJEZ' THEN ARRAY['vejez']
    WHEN 'G' THEN ARRAY['preventivo_mujer', 'materno_perinatal']
    WHEN 'PREVENTIVO_MUJER' THEN ARRAY['preventivo_mujer', 'materno_perinatal']
    WHEN 'MATERNO_PERINATAL' THEN ARRAY['preventivo_mujer', 'materno_perinatal']
    ELSE ARRAY[lower(trim(coalesce(p_code, 'adultez')))]
  END;
$$;

CREATE OR REPLACE FUNCTION public.classify_riesgo_id_3280(p_grupo_riesgo TEXT, p_program TEXT DEFAULT NULL)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_grupo_riesgo = 'Población Materno-Perinatal' THEN 1
    WHEN p_grupo_riesgo = 'Riesgo Cardiovascular, Metabólico y Renal' THEN 2
    WHEN p_grupo_riesgo IN ('Cáncer', 'Cáncer (Detección temprana y seguimiento)') THEN 3
    WHEN p_grupo_riesgo = 'Enfermedades Respiratorias Crónicas' THEN 4
    WHEN p_grupo_riesgo = 'Salud Mental y Sustancias Psicoactivas' THEN 5
    WHEN p_grupo_riesgo = 'Enfermedades Infecciosas y Zoonóticas' THEN 6
    WHEN p_grupo_riesgo = 'Alteraciones Nutricionales y del Crecimiento' THEN 7
    WHEN p_grupo_riesgo = 'Enfermedades Huérfanas y Neurológicas' THEN 8
    WHEN p_grupo_riesgo = 'Planificación Familiar' THEN 9
    WHEN p_grupo_riesgo = 'Vacunación PAI' THEN 10
    WHEN p_grupo_riesgo = 'Salud Oral' THEN 11
    WHEN p_grupo_riesgo IS NULL AND (p_program IS NULL OR p_program = '' OR p_program = 'Demanda Inducida Res. 3280') THEN 0
    ELSE (
      SELECT CASE
        WHEN s = '' OR s ~ '(preventiva general|sin grupo de riesgo|poblaci[oó]n general|demanda inducida res)' THEN 0
        WHEN s ~ '(materno|gestan|prenatal|riamp|puerper)' THEN 1
        WHEN s ~ '(cardio|hipertens|diabet|metab|renal|\bhta\b)' THEN 2
        WHEN s ~ '(c[aá]ncer|oncol)' THEN 3
        WHEN s ~ '(respira|asma|epoc|bronqu)' THEN 4
        WHEN s ~ '(mental|sustanc|psico|depres|ansied|violen|\bspa\b)' THEN 5
        WHEN s ~ '(infec|zoonot|\bvih\b|tubercul|dengue|malaria|chagas)' THEN 6
        WHEN s ~ '(nutric|desnutr|crecimiento|anemia)' THEN 7
        WHEN s ~ '(hu[eé]rfan|neurol|epilep|raras)' THEN 8
        WHEN s ~ '(planific|anticoncep|reproductiv)' THEN 9
        WHEN s ~ '(vacun|esquema pai|\bpai\b)' THEN 10
        WHEN s ~ '(salud oral|salud_oral|bucal|odont|fl[uú]or)' THEN 11
        ELSE 0
      END
      FROM (
        SELECT lower(coalesce(NULLIF(trim(p_grupo_riesgo), ''), NULLIF(trim(p_program), ''), '')) AS s
      ) t
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.patient_riesgo_ids_3280(
  p_grupos_riesgo TEXT[],
  p_grupo_riesgo TEXT DEFAULT NULL,
  p_program TEXT DEFAULT NULL
)
RETURNS INT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN (p_grupos_riesgo IS NULL OR cardinality(p_grupos_riesgo) = 0)
         AND p_grupo_riesgo IS NULL
         AND (p_program IS NULL OR p_program = '' OR p_program = 'Demanda Inducida Res. 3280')
      THEN ARRAY[]::INT[]
    WHEN p_grupos_riesgo IS NOT NULL AND cardinality(p_grupos_riesgo) > 0
      THEN COALESCE(
        (
          SELECT array_agg(DISTINCT rid ORDER BY rid)
          FROM (
            SELECT public.classify_riesgo_id_3280(x, NULL) AS rid
            FROM unnest(p_grupos_riesgo) AS x
          ) sub
          WHERE rid BETWEEN 1 AND 11
        ),
        ARRAY[]::INT[]
      )
    ELSE
      CASE
        WHEN public.classify_riesgo_id_3280(p_grupo_riesgo, p_program) BETWEEN 1 AND 11
          THEN ARRAY[public.classify_riesgo_id_3280(p_grupo_riesgo, p_program)]
        ELSE ARRAY[]::INT[]
      END
  END;
$$;

-- 3c. Elegibilidad Clínica Anual Res. 3280 (SQL inline ultra-rápido, fiel a Resolución 3280)
CREATE OR REPLACE FUNCTION public.is_patient_eligible_res3280(
  p_birthdate DATE,
  p_sex TEXT,
  p_curso_vida TEXT,
  p_grupos_riesgo TEXT[],
  p_grupo_riesgo TEXT,
  p_year INT DEFAULT 2026
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_curso_vida, 'adultez')) IN ('primera_infancia', 'infancia', 'adolescencia', 'preventivo_mujer', 'materno_perinatal')
      THEN TRUE
    WHEN (p_grupos_riesgo IS NOT NULL AND cardinality(p_grupos_riesgo) > 0)
         OR (p_grupo_riesgo IS NOT NULL AND public.classify_riesgo_id_3280(p_grupo_riesgo, NULL) > 0)
      THEN TRUE
    WHEN p_birthdate IS NULL
      THEN FALSE
    ELSE (
      SELECT CASE
        WHEN c = 'juventud' THEN (age_y IN (20, 26)) OR (is_f AND age_y IN (25, 28))
        WHEN c = 'adultez'  THEN (age_y IN (29, 34, 39, 44, 49, 52, 55, 58)) OR (age_y >= 50 AND age_y % 2 = 0)
        WHEN c = 'vejez'    THEN (age_y >= 60 AND ((age_y - 60) % 3 = 0))
        ELSE FALSE
      END
      FROM (
        SELECT
          lower(coalesce(p_curso_vida, 'adultez')) AS c,
          GREATEST(0, p_year - EXTRACT(YEAR FROM p_birthdate)::INT) AS age_y,
          (upper(left(coalesce(p_sex, ''), 1)) IN ('F', 'M') AND (upper(left(coalesce(p_sex, ''), 1)) = 'F' OR lower(coalesce(p_sex, '')) LIKE 'mujer%')) AS is_f
      ) vars
    )
  END;
$$;

-- 3d. Prioridad de Llamada (1 = Máxima -> 5 = Preventiva base, según Tablero_SADI_Campanas.xlsx)
CREATE OR REPLACE FUNCTION public.get_patient_priority_3280(
  p_curso_vida TEXT,
  p_grupos_riesgo TEXT[],
  p_grupo_riesgo TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_curso_vida, 'adultez')) IN ('preventivo_mujer', 'materno_perinatal')
         OR ('Población Materno-Perinatal' = ANY(COALESCE(p_grupos_riesgo, ARRAY[]::TEXT[])))
         OR (p_grupo_riesgo = 'Población Materno-Perinatal')
      THEN 1
    WHEN ('Cáncer (Detección temprana y seguimiento)' = ANY(COALESCE(p_grupos_riesgo, ARRAY[]::TEXT[])))
         OR ('Cáncer' = ANY(COALESCE(p_grupos_riesgo, ARRAY[]::TEXT[])))
         OR (p_grupo_riesgo IN ('Cáncer', 'Cáncer (Detección temprana y seguimiento)'))
      THEN 2
    WHEN lower(coalesce(p_curso_vida, 'adultez')) = 'primera_infancia'
         AND (
           (p_grupos_riesgo IS NOT NULL AND cardinality(p_grupos_riesgo) > 0)
           OR (p_grupo_riesgo IS NOT NULL AND public.classify_riesgo_id_3280(p_grupo_riesgo, NULL) > 0)
         )
      THEN 3
    WHEN (p_grupos_riesgo IS NOT NULL AND cardinality(p_grupos_riesgo) > 0)
         OR (p_grupo_riesgo IS NOT NULL AND public.classify_riesgo_id_3280(p_grupo_riesgo, NULL) > 0)
      THEN 4
    ELSE 5
  END;
$$;

-- 3e. Hito clínico y CUPS exactos Res. 3280 por edad, sexo y grupos de riesgo reales
CREATE OR REPLACE FUNCTION public.get_patient_res3280_action(
  p_birthdate DATE,
  p_sex TEXT,
  p_curso_vida TEXT,
  p_grupos_riesgo TEXT[],
  p_grupo_riesgo TEXT DEFAULT NULL,
  p_year INT DEFAULT 2026
)
RETURNS TABLE(accion TEXT, cups TEXT)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_curso TEXT := lower(coalesce(p_curso_vida, 'adultez'));
  v_age INT := CASE WHEN p_birthdate IS NOT NULL THEN GREATEST(0, p_year - EXTRACT(YEAR FROM p_birthdate)::INT) ELSE 30 END;
  v_is_f BOOLEAN := lower(coalesce(p_sex, '')) ~ '^(f|mujer)';
  v_rids INT[] := public.patient_riesgo_ids_3280(p_grupos_riesgo, p_grupo_riesgo, NULL);
BEGIN
  IF v_curso IN ('preventivo_mujer', 'materno_perinatal') OR (1 = ANY(v_rids)) THEN
    RETURN QUERY SELECT 'Control Prenatal / Seguimiento Materno-Perinatal (RIAMP)'::TEXT, '890201 · 890305'::TEXT;
    RETURN;
  END IF;
  IF 3 = ANY(v_rids) THEN
    RETURN QUERY SELECT 'Seguimiento Oncológico / Tamizaje Cáncer Prioritario'::TEXT, '890201 · 876802'::TEXT;
    RETURN;
  END IF;
  IF 2 = ANY(v_rids) THEN
    RETURN QUERY SELECT 'Control Riesgo Cardiovascular, Metabólico y Renal (HTA/DM/ERC)'::TEXT, '890201 · 903841'::TEXT;
    RETURN;
  END IF;
  IF 4 = ANY(v_rids) THEN
    RETURN QUERY SELECT 'Control Enfermedad Respiratoria Crónica (Asma / EPOC)'::TEXT, '890201 · 893805'::TEXT;
    RETURN;
  END IF;
  IF 5 = ANY(v_rids) THEN
    RETURN QUERY SELECT 'Seguimiento Salud Mental, Convivencia y SPA'::TEXT, '890208 · 890201'::TEXT;
    RETURN;
  END IF;
  IF 7 = ANY(v_rids) THEN
    RETURN QUERY SELECT 'Control Nutricional, Micronutrientes y Crecimiento'::TEXT, '890205 · 902211'::TEXT;
    RETURN;
  END IF;
  IF 6 = ANY(v_rids) THEN
    RETURN QUERY SELECT 'Seguimiento Enfermedades Infecciosas y Zoonóticas'::TEXT, '890201 · 906249'::TEXT;
    RETURN;
  END IF;
  IF 8 = ANY(v_rids) THEN
    RETURN QUERY SELECT 'Seguimiento Enfermedades Huérfanas y Neurológicas'::TEXT, '890201 · 890302'::TEXT;
    RETURN;
  END IF;
  IF 9 = ANY(v_rids) THEN
    RETURN QUERY SELECT 'Asesoría y Provisión de Planificación Familiar'::TEXT, '890201 · 697100'::TEXT;
    RETURN;
  END IF;
  IF 10 = ANY(v_rids) THEN
    RETURN QUERY SELECT 'Actualización Esquema Nacional de Vacunación (PAI)'::TEXT, '993120'::TEXT;
    RETURN;
  END IF;
  IF 11 = ANY(v_rids) THEN
    RETURN QUERY SELECT 'Atención Preventiva en Salud Oral (Flúor / Profilaxis)'::TEXT, '890203 · 997106'::TEXT;
    RETURN;
  END IF;

  -- Sin grupo de riesgo: Hitos exactos por Curso de Vida (Res. 3280 págs. 49-77)
  IF v_curso = 'primera_infancia' THEN
    IF v_age <= 1 THEN
      RETURN QUERY SELECT 'Valoración Integral Primera Infancia (Med/Enf) + Esquema PAI'::TEXT, '890201 · 993'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Control Crecimiento y Desarrollo + Odontología + Flúor Semestral'::TEXT, '890205 · 890203 · 997106'::TEXT;
    END IF;
    RETURN;
  END IF;
  IF v_curso = 'infancia' THEN
    IF v_age IN (6, 8, 10) THEN
      RETURN QUERY SELECT 'Valoración Integral Infancia (Medicina) + Salud Bucal'::TEXT, '890201 · 890203'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Valoración Integral Infancia (Enfermería) + Vacunación VPH/PAI'::TEXT, '890205 · 993'::TEXT;
    END IF;
    RETURN;
  END IF;
  IF v_curso = 'adolescencia' THEN
    IF v_age IN (12, 14, 16) THEN
      RETURN QUERY SELECT 'Valoración Integral Adolescencia (Medicina) + Profilaxis'::TEXT, '890201 · 997310'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Valoración Integral Adolescencia (Enfermería) + Tamizaje SSR'::TEXT, '890205 · 890203'::TEXT;
    END IF;
    RETURN;
  END IF;
  IF v_curso = 'juventud' THEN
    IF v_is_f AND v_age >= 25 THEN
      RETURN QUERY SELECT 'Valoración Juventud + Citología Cervicovaginal (Esquema 1-3-3)'::TEXT, '890201 · 892901'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Valoración Integral Juventud + Tamizaje RCV y Salud Oral'::TEXT, '890201 · 890203'::TEXT;
    END IF;
    RETURN;
  END IF;
  IF v_curso = 'adultez' THEN
    IF v_is_f AND v_age >= 50 THEN
      RETURN QUERY SELECT 'Valoración Adultez + Mamografía Bilateral + ADN-VPH / Colon'::TEXT, '890201 · 876802 · 908436'::TEXT;
    ELSIF NOT v_is_f AND v_age >= 50 THEN
      RETURN QUERY SELECT 'Valoración Adultez + Tamizaje PSA Próstata + Sangre Oculta Heces'::TEXT, '890201 · 906611 · 907009'::TEXT;
    ELSIF v_is_f AND v_age >= 30 THEN
      RETURN QUERY SELECT 'Valoración Quinquenal Adultez + Prueba ADN-VPH / Mama'::TEXT, '890201 · 908436'::TEXT;
    ELSE
      RETURN QUERY SELECT 'Valoración Integral Adultez + Tamizaje RCV Quinquenal'::TEXT, '890201 · 903841'::TEXT;
    END IF;
    RETURN;
  END IF;

  -- Vejez (60+)
  RETURN QUERY SELECT 'Valoración Geriátrica Integral Trienal + Tamizaje RCV / Oncológico'::TEXT, '890201 · 903841 · 907009'::TEXT;
END;
$$;

-- 3f. Festivos oficiales de Colombia (2025, 2026, 2027 - Tablero_SADI_Campanas.xlsx) y días hábiles Lun-Sáb
CREATE OR REPLACE FUNCTION public.is_colombia_holiday(p_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_date = ANY(ARRAY[
    -- 2025
    DATE '2025-01-01', DATE '2025-01-06', DATE '2025-03-24', DATE '2025-04-17', DATE '2025-04-18',
    DATE '2025-05-01', DATE '2025-06-02', DATE '2025-06-23', DATE '2025-06-30', DATE '2025-07-20',
    DATE '2025-08-07', DATE '2025-08-18', DATE '2025-10-13', DATE '2025-11-03', DATE '2025-11-17',
    DATE '2025-12-08', DATE '2025-12-25',
    -- 2026
    DATE '2026-01-01', DATE '2026-01-12', DATE '2026-03-23', DATE '2026-04-02', DATE '2026-04-03',
    DATE '2026-05-01', DATE '2026-05-18', DATE '2026-06-08', DATE '2026-06-15', DATE '2026-06-29',
    DATE '2026-07-20', DATE '2026-08-07', DATE '2026-08-17', DATE '2026-10-12', DATE '2026-11-02',
    DATE '2026-11-16', DATE '2026-12-08', DATE '2026-12-25',
    -- 2027
    DATE '2027-01-01', DATE '2027-01-11', DATE '2027-03-22', DATE '2027-03-25', DATE '2027-03-26',
    DATE '2027-05-01', DATE '2027-05-10', DATE '2027-05-31', DATE '2027-06-07', DATE '2027-07-05',
    DATE '2027-07-20', DATE '2027-08-07', DATE '2027-08-16', DATE '2027-10-18', DATE '2027-11-01',
    DATE '2027-11-15', DATE '2027-12-08', DATE '2027-12-25'
  ]);
$$;

CREATE OR REPLACE FUNCTION public.get_month_workdays_3280(p_year INT, p_month INT)
RETURNS DATE[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    array_agg(d::date ORDER BY d::date),
    ARRAY[]::DATE[]
  )
  FROM generate_series(
    make_date(p_year, p_month, 1),
    (make_date(p_year, p_month, 1) + INTERVAL '1 month - 1 day')::date,
    INTERVAL '1 day'
  ) AS d
  WHERE EXTRACT(DOW FROM d) <> 0
    AND NOT public.is_colombia_holiday(d::date);
$$;

-- 4. Función de asignación automática determinística de 1 paciente según curso_vida (7 cursos A-G)
CREATE OR REPLACE FUNCTION public.pick_doctor_for_patient_3280(
  p_hospital_id UUID,
  p_curso_vida TEXT,
  p_seed_key TEXT
)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  WITH specific_pool AS (
    SELECT s.doctor_id,
           row_number() OVER (
             ORDER BY
               CASE s.rol
                 WHEN 'Especialista' THEN 1
                 WHEN 'Médico General' THEN 2
                 WHEN 'Enfermera' THEN 3
                 ELSE 4
               END,
               s.doctor_id
           ) AS rn,
           count(*) OVER () AS cnt
    FROM public.staff s
    WHERE (p_hospital_id IS NULL OR s.hospital_id = p_hospital_id)
      AND s.is_active = TRUE
      AND s.doctor_name IS NOT NULL
      AND jsonb_typeof(COALESCE(s.cursos_vida_asignados, '[]'::jsonb)) = 'array'
      AND (s.cursos_vida_asignados ? p_curso_vida)
      AND NOT (s.cursos_vida_asignados ? 'todos')
  ),
  fallback_pool AS (
    SELECT s.doctor_id,
           row_number() OVER (ORDER BY s.doctor_id) AS rn,
           count(*) OVER () AS cnt
    FROM public.staff s
    WHERE (p_hospital_id IS NULL OR s.hospital_id = p_hospital_id)
      AND s.is_active = TRUE
      AND s.doctor_name IS NOT NULL
      AND jsonb_typeof(COALESCE(s.cursos_vida_asignados, '[]'::jsonb)) = 'array'
      AND (s.cursos_vida_asignados ? 'todos')
      AND NOT EXISTS (SELECT 1 FROM specific_pool)
  ),
  combined AS (
    SELECT doctor_id, rn, cnt FROM specific_pool
    UNION ALL
    SELECT doctor_id, rn, cnt FROM fallback_pool
  )
  SELECT doctor_id
  FROM combined
  WHERE rn = (abs(hashtextextended(COALESCE(NULLIF(p_seed_key, ''), 'default'), 0)) % cnt)::INT + 1
  LIMIT 1;
$$;

-- 5. Trigger para clasificar automáticamente por edad (7 cursos A-G) y sincronizar doctor_id y grupos_riesgo
CREATE OR REPLACE FUNCTION public.trg_patients_classify_and_assign_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_curso VARCHAR(40);
BEGIN
  v_new_curso := public.classify_curso_vida_3280(NEW.birthdate, NEW.program, NEW.curso_vida);
  NEW.curso_vida := v_new_curso;

  -- Asegurar que grupo_riesgo nunca almacene etiqueta falsa genérica si grupos_riesgo está vacío
  IF NEW.grupos_riesgo IS NULL THEN
    NEW.grupos_riesgo := '{}'::text[];
  END IF;
  IF COALESCE(array_length(NEW.grupos_riesgo, 1), 0) = 0
     AND NEW.grupo_riesgo IS NOT NULL
     AND public.classify_riesgo_id_3280(NEW.grupo_riesgo, NULL) > 0 THEN
    NEW.grupos_riesgo := ARRAY[NEW.grupo_riesgo];
  ELSIF COALESCE(array_length(NEW.grupos_riesgo, 1), 0) > 0 AND (NEW.grupo_riesgo IS NULL OR public.classify_riesgo_id_3280(NEW.grupo_riesgo, NULL) = 0) THEN
    NEW.grupo_riesgo := NEW.grupos_riesgo[1];
  ELSIF COALESCE(array_length(NEW.grupos_riesgo, 1), 0) = 0
        AND NEW.grupo_riesgo IS NOT NULL
        AND public.classify_riesgo_id_3280(NEW.grupo_riesgo, NULL) = 0 THEN
    NEW.grupo_riesgo := NULL;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.doctor_id IS NULL THEN
    NEW.doctor_id := public.pick_doctor_for_patient_3280(
      NEW.hospital_id,
      v_new_curso,
      COALESCE(NULLIF(NEW.document, ''), NEW.patient_id::text)
    );
  ELSIF TG_OP = 'UPDATE' AND (NEW.birthdate IS DISTINCT FROM OLD.birthdate OR NEW.program IS DISTINCT FROM OLD.program) THEN
    IF NEW.doctor_id IS NOT DISTINCT FROM OLD.doctor_id THEN
      NEW.doctor_id := public.pick_doctor_for_patient_3280(
        NEW.hospital_id,
        v_new_curso,
        COALESCE(NULLIF(NEW.document, ''), NEW.patient_id::text)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patients_classify_and_assign ON public.patients;
CREATE TRIGGER trg_patients_classify_and_assign
  BEFORE INSERT OR UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_patients_classify_and_assign_fn();

-- 5b. Proteger trigger_auto_create_patient_auth ante pacientes sin email
CREATE OR REPLACE FUNCTION public.auto_create_patient_auth()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_hashed_password TEXT;
BEGIN
  IF NEW.email IS NOT NULL AND TRIM(NEW.email) <> '' THEN
    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = NEW.patient_id) THEN
      v_hashed_password := extensions.crypt(COALESCE(NULLIF(TRIM(NEW.document), ''), 'sadi2026'), extensions.gen_salt('bf'));
      INSERT INTO users (
        user_id, email, password, role, is_active, created_at
      ) VALUES (
        NEW.patient_id, LOWER(TRIM(NEW.email)), v_hashed_password, 'patient', true, NOW()
      )
      ON CONFLICT (email) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 6. RPC masivo de clasificación por edad (7 Cursos A-G) y re-asignación automática 1:1
CREATE OR REPLACE FUNCTION public.auto_assign_patients_doctors(
  p_hospital_id UUID DEFAULT NULL,
  p_only_unassigned BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
AS $$
DECLARE
  v_updated INT := 0;
  v_by_curso JSONB;
  v_by_doctor JSONB;
BEGIN
  UPDATE public.patients p
  SET curso_vida = public.classify_curso_vida_3280(p.birthdate, p.program, p.curso_vida)
  WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
    AND p.curso_vida IS DISTINCT FROM public.classify_curso_vida_3280(p.birthdate, p.program, p.curso_vida);

  WITH course_keys AS (
    SELECT unnest(ARRAY[
      'primera_infancia','infancia','adolescencia','juventud','adultez','vejez','preventivo_mujer'
    ]) AS ckey
  ),
  pools AS (
    SELECT
      s.hospital_id,
      ck.ckey,
      s.doctor_id,
      row_number() OVER (
        PARTITION BY s.hospital_id, ck.ckey
        ORDER BY
          CASE s.rol WHEN 'Especialista' THEN 1 WHEN 'Médico General' THEN 2 WHEN 'Enfermera' THEN 3 ELSE 4 END,
          s.doctor_id
      ) AS rn,
      count(*) OVER (PARTITION BY s.hospital_id, ck.ckey) AS cnt
    FROM public.staff s
    CROSS JOIN course_keys ck
    WHERE (p_hospital_id IS NULL OR s.hospital_id = p_hospital_id)
      AND s.is_active = TRUE
      AND s.doctor_name IS NOT NULL
      AND jsonb_typeof(COALESCE(s.cursos_vida_asignados, '[]'::jsonb)) = 'array'
      AND (s.cursos_vida_asignados ? ck.ckey)
      AND NOT (s.cursos_vida_asignados ? 'todos')
  ),
  computed AS (
    SELECT
      p.patient_id,
      COALESCE(
        pl.doctor_id,
        (
          SELECT s2.doctor_id
          FROM public.staff s2
          WHERE s2.hospital_id = p.hospital_id
            AND s2.is_active = TRUE
            AND s2.doctor_name IS NOT NULL
            AND (s2.cursos_vida_asignados ? 'todos')
          ORDER BY s2.doctor_id
          LIMIT 1
        )
      ) AS target_doctor_id
    FROM public.patients p
    LEFT JOIN pools pl
      ON pl.hospital_id = p.hospital_id
     AND pl.ckey = p.curso_vida
     AND pl.rn = (abs(hashtextextended(COALESCE(NULLIF(p.document, ''), p.patient_id::text), 0)) % pl.cnt)::INT + 1
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (NOT p_only_unassigned OR p.doctor_id IS NULL)
  ),
  upd AS (
    UPDATE public.patients p
    SET doctor_id = c.target_doctor_id
    FROM computed c
    WHERE p.patient_id = c.patient_id
      AND p.doctor_id IS DISTINCT FROM c.target_doctor_id
    RETURNING p.patient_id
  )
  SELECT count(*) INTO v_updated FROM upd;

  SELECT COALESCE(jsonb_object_agg(curso_vida, cnt), '{}'::jsonb)
  INTO v_by_curso
  FROM (
    SELECT COALESCE(curso_vida, 'sin_clasificar') AS curso_vida, count(*) AS cnt
    FROM public.patients
    WHERE (p_hospital_id IS NULL OR hospital_id = p_hospital_id)
    GROUP BY 1
  ) sub;

  SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb)
  INTO v_by_doctor
  FROM (
    SELECT s.doctor_id, s.doctor_name, s.doctor_email, count(p.patient_id) AS assigned_count
    FROM public.staff s
    LEFT JOIN public.patients p ON p.doctor_id = s.doctor_id AND (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
    WHERE (p_hospital_id IS NULL OR s.hospital_id = p_hospital_id)
      AND s.doctor_name IS NOT NULL
    GROUP BY s.doctor_id, s.doctor_name, s.doctor_email
    ORDER BY assigned_count DESC
  ) d;

  RETURN jsonb_build_object(
    'success', TRUE,
    'updated', v_updated,
    'by_curso_vida', v_by_curso,
    'by_doctor', v_by_doctor
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_assign_patients_doctors(UUID, BOOLEAN) TO anon, authenticated;

-- 7. RPC Demografía Dashboard
CREATE OR REPLACE FUNCTION public.get_dashboard_patient_demography(p_hospital_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_patients BIGINT,
  hombres BIGINT,
  mujeres BIGINT,
  ninos BIGINT,
  ninas BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
  SELECT
    count(*)::BIGINT AS total_patients,
    count(*) FILTER (
      WHERE (p.sex IS NULL OR p.sex NOT IN ('F', 'f', 'Femenino', 'femenino', 'Mujer', 'mujer', 'Female', 'female'))
        AND (p.birthdate IS NULL OR p.birthdate <= (CURRENT_DATE - INTERVAL '18 years')::date)
    )::BIGINT AS hombres,
    count(*) FILTER (
      WHERE p.sex IN ('F', 'f', 'Femenino', 'femenino', 'Mujer', 'mujer', 'Female', 'female')
        AND (p.birthdate IS NULL OR p.birthdate <= (CURRENT_DATE - INTERVAL '18 years')::date)
    )::BIGINT AS mujeres,
    count(*) FILTER (
      WHERE (p.sex IS NULL OR p.sex NOT IN ('F', 'f', 'Femenino', 'femenino', 'Mujer', 'mujer', 'Female', 'female'))
        AND p.birthdate IS NOT NULL
        AND p.birthdate > (CURRENT_DATE - INTERVAL '18 years')::date
    )::BIGINT AS ninos,
    count(*) FILTER (
      WHERE p.sex IN ('F', 'f', 'Femenino', 'femenino', 'Mujer', 'mujer', 'Female', 'female')
        AND p.birthdate IS NOT NULL
        AND p.birthdate > (CURRENT_DATE - INTERVAL '18 years')::date
    )::BIGINT AS ninas
  FROM public.patients p
  WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_patient_demography(UUID) TO anon, authenticated;

-- 8. Función de normalización sin tildes + Índice GIN trigrama + RPC Paginado de Pacientes
CREATE OR REPLACE FUNCTION public.sadi_norm_search(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT translate(
    lower(COALESCE(p_text, '')),
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncaaaaaeeeeiiiiooooouuuunc'
  );
$$;

GRANT EXECUTE ON FUNCTION public.sadi_norm_search(TEXT) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS gin_patients_search_norm_trgm
ON public.patients
USING gin (
  public.sadi_norm_search(
    COALESCE(name, '') || ' ' ||
    COALESCE(document, '') || ' ' ||
    COALESCE(phone, '') || ' ' ||
    COALESCE(barrio, '') || ' ' ||
    COALESCE(city, '') || ' ' ||
    COALESCE(curso_vida, '')
  ) gin_trgm_ops
);

DROP FUNCTION IF EXISTS public.get_patients_paginated(UUID, TEXT, TEXT, UUID, INT, INT);
CREATE OR REPLACE FUNCTION public.get_patients_paginated(
  p_hospital_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_curso_vida TEXT DEFAULT 'todos',
  p_doctor_id UUID DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50
)
RETURNS TABLE (
  patient_id UUID,
  hospital_id UUID,
  name TEXT,
  document VARCHAR,
  tipo_documento VARCHAR,
  llave VARCHAR,
  phone VARCHAR,
  email VARCHAR,
  birthdate DATE,
  sex VARCHAR,
  city VARCHAR,
  address VARCHAR,
  program TEXT,
  curso_vida VARCHAR,
  grupo_riesgo VARCHAR,
  grupos_riesgo TEXT[],
  zona VARCHAR,
  barrio VARCHAR,
  comuna VARCHAR,
  corregimiento VARCHAR,
  vereda VARCHAR,
  centro_poblado VARCHAR,
  eps VARCHAR,
  ips_asignada VARCHAR,
  tipo_usuario VARCHAR,
  dispositivos_caseros JSONB,
  valores_criticos JSONB,
  historial_medidas JSONB,
  conteo_canales JSONB,
  doctor_id UUID,
  doctor_name TEXT,
  doctor_email TEXT,
  doctor_specialty TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_norm TEXT := NULLIF(trim(regexp_replace(public.sadi_norm_search(COALESCE(p_search, '')), '\s+', ' ', 'g')), '');
  v_digits TEXT := regexp_replace(COALESCE(p_search, ''), '[^0-9]', '', 'g');
  v_is_numeric BOOLEAN := FALSE;
  v_tokens TEXT[] := ARRAY[]::TEXT[];
  v_lead_tok TEXT := NULL;
  v_curso TEXT := NULLIF(lower(trim(COALESCE(p_curso_vida, ''))), '');
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_page_size, 50), 1000));
  v_offset INT := (GREATEST(1, COALESCE(p_page, 1)) - 1) * v_limit;
  v_total BIGINT := 0;
BEGIN
  IF v_curso = 'todos' THEN
    v_curso := NULL;
  END IF;

  IF v_norm IS NULL THEN
    SELECT count(*)::BIGINT
    INTO v_total
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (p_doctor_id IS NULL OR p.doctor_id = p_doctor_id)
      AND (v_curso IS NULL OR p.curso_vida = v_curso);

    RETURN QUERY
    SELECT
      p.patient_id, p.hospital_id, p.name, p.document, p.tipo_documento, p.llave,
      p.phone, p.email, p.birthdate, p.sex, p.city, p.address, p.program,
      COALESCE(p.curso_vida, 'adultez'::varchar) AS curso_vida,
      p.grupo_riesgo, COALESCE(p.grupos_riesgo, '{}'::text[]) AS grupos_riesgo,
      p.zona, p.barrio, p.comuna, p.corregimiento, p.vereda, p.centro_poblado,
      p.eps, p.ips_asignada, p.tipo_usuario,
      p.dispositivos_caseros, p.valores_criticos, p.historial_medidas, p.conteo_canales,
      p.doctor_id, s.doctor_name, s.doctor_email, s.doctor_specialty, p.created_at, v_total
    FROM public.patients p
    LEFT JOIN public.staff s ON s.doctor_id = p.doctor_id
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (p_doctor_id IS NULL OR p.doctor_id = p_doctor_id)
      AND (v_curso IS NULL OR p.curso_vida = v_curso)
    ORDER BY p.created_at DESC NULLS LAST, p.patient_id
    LIMIT v_limit
    OFFSET v_offset;
    RETURN;
  END IF;

  v_is_numeric := (v_norm ~ '^[0-9\.\-\+\s]+$' AND length(v_digits) >= 3);
  IF v_is_numeric THEN
    RETURN QUERY
    WITH matched AS (
      SELECT
        p.patient_id, p.hospital_id, p.name, p.document, p.tipo_documento, p.llave,
        p.phone, p.email, p.birthdate, p.sex, p.city, p.address, p.program,
        COALESCE(p.curso_vida, 'adultez'::varchar) AS curso_vida,
        p.grupo_riesgo, COALESCE(p.grupos_riesgo, '{}'::text[]) AS grupos_riesgo,
        p.zona, p.barrio, p.comuna, p.corregimiento, p.vereda, p.centro_poblado,
        p.eps, p.ips_asignada, p.tipo_usuario,
        p.dispositivos_caseros, p.valores_criticos, p.historial_medidas, p.conteo_canales,
        p.doctor_id, p.created_at,
        CASE WHEN p.document = v_digits THEN 0 ELSE 1 END AS exact_rank,
        count(*) OVER()::BIGINT AS total_count
      FROM public.patients p
      WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
        AND (p_doctor_id IS NULL OR p.doctor_id = p_doctor_id)
        AND (v_curso IS NULL OR p.curso_vida = v_curso)
        AND (
          p.document = v_digits
          OR p.document ILIKE '%' || v_digits || '%'
          OR p.phone ILIKE '%' || v_digits || '%'
        )
    )
    SELECT
      m.patient_id, m.hospital_id, m.name, m.document, m.tipo_documento, m.llave,
      m.phone, m.email, m.birthdate, m.sex, m.city, m.address, m.program,
      m.curso_vida, m.grupo_riesgo, m.grupos_riesgo,
      m.zona, m.barrio, m.comuna, m.corregimiento, m.vereda, m.centro_poblado,
      m.eps, m.ips_asignada, m.tipo_usuario,
      m.dispositivos_caseros, m.valores_criticos, m.historial_medidas, m.conteo_canales,
      m.doctor_id, s.doctor_name, s.doctor_email, s.doctor_specialty, m.created_at, m.total_count
    FROM matched m
    LEFT JOIN public.staff s ON s.doctor_id = m.doctor_id
    ORDER BY m.exact_rank ASC, m.created_at DESC NULLS LAST, m.patient_id
    LIMIT v_limit
    OFFSET v_offset;
    RETURN;
  END IF;

  v_tokens := regexp_split_to_array(v_norm, '\s+');
  SELECT tok INTO v_lead_tok FROM unnest(v_tokens) AS tok ORDER BY length(tok) DESC LIMIT 1;

  RETURN QUERY
  WITH matched AS (
    SELECT
      p.patient_id, p.hospital_id, p.name, p.document, p.tipo_documento, p.llave,
      p.phone, p.email, p.birthdate, p.sex, p.city, p.address, p.program,
      COALESCE(p.curso_vida, 'adultez'::varchar) AS curso_vida,
      p.grupo_riesgo, COALESCE(p.grupos_riesgo, '{}'::text[]) AS grupos_riesgo,
      p.zona, p.barrio, p.comuna, p.corregimiento, p.vereda, p.centro_poblado,
      p.eps, p.ips_asignada, p.tipo_usuario,
      p.dispositivos_caseros, p.valores_criticos, p.historial_medidas, p.conteo_canales,
      p.doctor_id, p.created_at,
      count(*) OVER()::BIGINT AS total_count
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (p_doctor_id IS NULL OR p.doctor_id = p_doctor_id)
      AND (v_curso IS NULL OR p.curso_vida = v_curso)
      AND public.sadi_norm_search(
        COALESCE(p.name, '') || ' ' ||
        COALESCE(p.document, '') || ' ' ||
        COALESCE(p.phone, '') || ' ' ||
        COALESCE(p.barrio, '') || ' ' ||
        COALESCE(p.city, '') || ' ' ||
        COALESCE(p.curso_vida, '')
      ) LIKE '%' || v_lead_tok || '%'
      AND (
        array_length(v_tokens, 1) <= 1
        OR NOT EXISTS (
          SELECT 1
          FROM unnest(v_tokens) AS t
          WHERE public.sadi_norm_search(
            COALESCE(p.name, '') || ' ' ||
            COALESCE(p.document, '') || ' ' ||
            COALESCE(p.phone, '') || ' ' ||
            COALESCE(p.barrio, '') || ' ' ||
            COALESCE(p.city, '') || ' ' ||
            COALESCE(p.curso_vida, '')
          ) NOT LIKE '%' || t || '%'
        )
      )
  )
  SELECT
    m.patient_id, m.hospital_id, m.name, m.document, m.tipo_documento, m.llave,
    m.phone, m.email, m.birthdate, m.sex, m.city, m.address, m.program,
    m.curso_vida, m.grupo_riesgo, m.grupos_riesgo,
    m.zona, m.barrio, m.comuna, m.corregimiento, m.vereda, m.centro_poblado,
    m.eps, m.ips_asignada, m.tipo_usuario,
    m.dispositivos_caseros, m.valores_criticos, m.historial_medidas, m.conteo_canales,
    m.doctor_id, s.doctor_name, s.doctor_email, s.doctor_specialty, m.created_at, m.total_count
  FROM matched m
  LEFT JOIN public.staff s ON s.doctor_id = m.doctor_id
  ORDER BY m.created_at DESC NULLS LAST, m.patient_id
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patients_paginated(UUID, TEXT, TEXT, UUID, INT, INT) TO anon, authenticated;

-- 9. RPC Estadísticas de Personal y Asignaciones
CREATE OR REPLACE FUNCTION public.get_staff_assignment_stats(p_hospital_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
  WITH curso_counts AS (
    SELECT COALESCE(curso_vida, 'adultez') AS ckey,
           count(*)::BIGINT AS cnt
    FROM public.patients
    WHERE (p_hospital_id IS NULL OR hospital_id = p_hospital_id)
    GROUP BY 1
  ),
  direct_counts AS (
    SELECT doctor_id, count(*)::BIGINT AS cnt
    FROM public.patients
    WHERE (p_hospital_id IS NULL OR hospital_id = p_hospital_id)
      AND doctor_id IS NOT NULL
    GROUP BY 1
  ),
  total_pts AS (
    SELECT COALESCE(sum(cnt), 0)::BIGINT AS total FROM curso_counts
  )
  SELECT jsonb_build_object(
    'total_patients', (SELECT total FROM total_pts),
    'by_curso', (SELECT COALESCE(jsonb_object_agg(ckey, cnt), '{}'::jsonb) FROM curso_counts),
    'by_doctor_direct', (SELECT COALESCE(jsonb_object_agg(doctor_id::text, cnt), '{}'::jsonb) FROM direct_counts)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_assignment_stats(UUID) TO anon, authenticated;

-- 10. RPC Paginado de Cohorte Asignada a un Profesional (incluye grupos_riesgo TEXT[])
DROP FUNCTION IF EXISTS public.get_doctor_assigned_patients_paginated(UUID, TEXT[], UUID, TEXT, TEXT, INT, INT);
CREATE OR REPLACE FUNCTION public.get_doctor_assigned_patients_paginated(
  p_doctor_id UUID DEFAULT NULL,
  p_cursos TEXT[] DEFAULT NULL,
  p_hospital_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_mode TEXT DEFAULT 'scope',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50
)
RETURNS TABLE (
  patient_id UUID,
  hospital_id UUID,
  name TEXT,
  document VARCHAR,
  tipo_documento VARCHAR,
  phone VARCHAR,
  email VARCHAR,
  birthdate DATE,
  sex VARCHAR,
  city VARCHAR,
  address VARCHAR,
  program TEXT,
  curso_vida VARCHAR,
  grupo_riesgo VARCHAR,
  grupos_riesgo TEXT[],
  zona VARCHAR,
  barrio VARCHAR,
  comuna VARCHAR,
  corregimiento VARCHAR,
  vereda VARCHAR,
  centro_poblado VARCHAR,
  eps VARCHAR,
  ips_asignada VARCHAR,
  tipo_usuario VARCHAR,
  dispositivos_caseros JSONB,
  valores_criticos JSONB,
  historial_medidas JSONB,
  conteo_canales JSONB,
  doctor_id UUID,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_cursos TEXT[] := p_cursos;
  v_has_todos BOOLEAN := FALSE;
  v_norm TEXT := NULLIF(trim(regexp_replace(public.sadi_norm_search(COALESCE(p_search, '')), '\s+', ' ', 'g')), '');
  v_digits TEXT := regexp_replace(COALESCE(p_search, ''), '[^0-9]', '', 'g');
  v_is_numeric BOOLEAN := FALSE;
  v_tokens TEXT[] := ARRAY[]::TEXT[];
  v_lead_tok TEXT := NULL;
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_page_size, 50), 1000));
  v_offset INT := (GREATEST(1, COALESCE(p_page, 1)) - 1) * v_limit;
BEGIN
  IF v_cursos IS NULL AND p_doctor_id IS NOT NULL THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(COALESCE(s.cursos_vida_asignados, '[]'::jsonb)))
    INTO v_cursos
    FROM public.staff s
    WHERE s.doctor_id = p_doctor_id;
  END IF;

  v_has_todos := ('todos' = ANY(COALESCE(v_cursos, ARRAY[]::TEXT[])));

  IF p_mode <> 'direct' AND (v_cursos IS NULL OR array_length(v_cursos, 1) IS NULL OR array_length(v_cursos, 1) = 0) THEN
    RETURN;
  END IF;

  IF p_mode = 'direct' AND p_doctor_id IS NULL THEN
    RETURN;
  END IF;

  v_is_numeric := (v_norm IS NOT NULL AND v_norm ~ '^[0-9\.\-\+\s]+$' AND length(v_digits) >= 3);
  IF v_norm IS NOT NULL AND NOT v_is_numeric THEN
    v_tokens := regexp_split_to_array(v_norm, '\s+');
    SELECT tok INTO v_lead_tok FROM unnest(v_tokens) AS tok ORDER BY length(tok) DESC LIMIT 1;
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT
      p.patient_id, p.hospital_id, p.name, p.document, p.tipo_documento,
      p.phone, p.email, p.birthdate, p.sex, p.city, p.address, p.program,
      COALESCE(p.curso_vida, 'adultez'::varchar) AS curso_vida,
      p.grupo_riesgo, COALESCE(p.grupos_riesgo, '{}'::text[]) AS grupos_riesgo,
      p.zona, p.barrio, p.comuna, p.corregimiento, p.vereda, p.centro_poblado,
      p.eps, p.ips_asignada, p.tipo_usuario,
      p.dispositivos_caseros, p.valores_criticos, p.historial_medidas, p.conteo_canales,
      p.doctor_id, p.created_at,
      count(*) OVER()::BIGINT AS total_count
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (
        (p_mode = 'direct' AND p.doctor_id = p_doctor_id)
        OR (p_mode <> 'direct' AND (v_has_todos OR p.curso_vida = ANY(v_cursos)))
      )
      AND (
        v_norm IS NULL
        OR (
          v_is_numeric AND (
            p.document = v_digits
            OR p.document ILIKE '%' || v_digits || '%'
            OR p.phone ILIKE '%' || v_digits || '%'
          )
        )
        OR (
          NOT v_is_numeric
          AND public.sadi_norm_search(
            COALESCE(p.name, '') || ' ' ||
            COALESCE(p.document, '') || ' ' ||
            COALESCE(p.phone, '') || ' ' ||
            COALESCE(p.barrio, '') || ' ' ||
            COALESCE(p.city, '') || ' ' ||
            COALESCE(p.curso_vida, '')
          ) LIKE '%' || v_lead_tok || '%'
          AND (
            array_length(v_tokens, 1) <= 1
            OR NOT EXISTS (
              SELECT 1 FROM unnest(v_tokens) AS t
              WHERE public.sadi_norm_search(
                COALESCE(p.name, '') || ' ' ||
                COALESCE(p.document, '') || ' ' ||
                COALESCE(p.phone, '') || ' ' ||
                COALESCE(p.barrio, '') || ' ' ||
                COALESCE(p.city, '') || ' ' ||
                COALESCE(p.curso_vida, '')
              ) NOT LIKE '%' || t || '%'
            )
          )
        )
      )
  )
  SELECT
    m.patient_id, m.hospital_id, m.name, m.document, m.tipo_documento,
    m.phone, m.email, m.birthdate, m.sex, m.city, m.address, m.program,
    m.curso_vida, m.grupo_riesgo, m.grupos_riesgo,
    m.zona, m.barrio, m.comuna, m.corregimiento, m.vereda, m.centro_poblado,
    m.eps, m.ips_asignada, m.tipo_usuario,
    m.dispositivos_caseros, m.valores_criticos, m.historial_medidas, m.conteo_canales,
    m.doctor_id, m.created_at, m.total_count
  FROM matched m
  ORDER BY m.created_at DESC NULLS LAST, m.patient_id
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_assigned_patients_paginated(UUID, TEXT[], UUID, TEXT, TEXT, INT, INT) TO anon, authenticated;

-- 11. RPC Matriz Consolidada de Reportes (7 Cursos A-G + 11 Grupos de Riesgo reales + Atribución 100% por Paciente + Efectividad + Trazabilidad + Caché auto-invalidada)
CREATE OR REPLACE FUNCTION public.get_reports_demanda_summary(
  p_hospital_id UUID DEFAULT NULL,
  p_curso_vida TEXT DEFAULT 'todos',
  p_grupo_riesgo TEXT DEFAULT 'todos',
  p_zona TEXT DEFAULT 'todos',
  p_comuna TEXT DEFAULT 'todos',
  p_barrio TEXT DEFAULT 'todos'
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_cache_key TEXT;
  v_cached JSONB;
  v_res JSONB;
BEGIN
  v_cache_key := 'reports_v3:' || COALESCE(p_hospital_id::text, 'ALL') || ':' ||
    COALESCE(p_curso_vida, 'todos') || ':' || COALESCE(p_grupo_riesgo, 'todos') || ':' ||
    COALESCE(p_zona, 'todos') || ':' || COALESCE(p_comuna, 'todos') || ':' || COALESCE(p_barrio, 'todos');

  SELECT payload INTO v_cached FROM public.cronograma_summary_cache WHERE cache_key = v_cache_key;
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  WITH vapi_events AS MATERIALIZED (
    SELECT
      v.id::text AS event_id,
      'vapi_agent_sessions'::text AS source_table,
      v.patient_id,
      'call'::text AS canal,
      COALESCE(v.motivo_llamada, 'Llamada IA Vapi')::text AS motivo,
      COALESCE(v.estado_llamada, CASE WHEN COALESCE(v.deteccion_buzon, FALSE) THEN 'buzon' ELSE 'registrada' END)::text AS resultado,
      (NOT COALESCE(v.deteccion_buzon, FALSE) AND (lower(COALESCE(v.estado_llamada, '')) IN ('completada', 'completed', 'exitosa', 'answered') OR COALESCE(v.duracion_segundos, 0) > 0)) AS efectiva,
      COALESCE(v.duracion_segundos, 0)::INT AS duracion_segundos,
      v.created_at
    FROM public.vapi_agent_sessions v
    JOIN public.patients p ON p.patient_id = v.patient_id
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id OR v.hospital_id = p_hospital_id)
  ),
  evidence_events AS MATERIALIZED (
    SELECT
      e.id::text AS event_id,
      'ai_contact_evidence'::text AS source_table,
      e.patient_id,
      CASE
        WHEN lower(COALESCE(e.canal, '')) ~ 'sms' THEN 'sms'
        WHEN lower(COALESCE(e.canal, '')) ~ '(email|mail|correo)' THEN 'email'
        WHEN lower(COALESCE(e.canal, '')) ~ '(what|wpp)' THEN 'whatsapp'
        WHEN lower(COALESCE(e.canal, '')) ~ '(call|llamada|voz|vapi|tel)' THEN 'call'
        ELSE NULL
      END AS canal,
      COALESCE(e.motivo_contacto, 'Contacto IA Res. 3280')::text AS motivo,
      COALESCE(e.resultado_contacto, 'registrado')::text AS resultado,
      (NOT COALESCE(e.deteccion_buzon, FALSE) AND lower(COALESCE(e.resultado_contacto, '')) IN ('contactado_exitoso', 'exitoso', 'completado', 'confirmada', 'entregado')) AS efectiva,
      COALESCE(e.duracion_segundos, 0)::INT AS duracion_segundos,
      e.created_at
    FROM public.ai_contact_evidence e
    JOIN public.patients p ON p.patient_id = e.patient_id
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND NOT (
        lower(COALESCE(e.canal, '')) ~ '(call|llamada|voz|vapi|tel)'
        AND EXISTS (
          SELECT 1 FROM vapi_events ve
          WHERE ve.patient_id = e.patient_id
            AND abs(EXTRACT(EPOCH FROM (ve.created_at - e.created_at))) <= 120
        )
      )
  ),
  sms_events AS MATERIALIZED (
    SELECT
      s.id::text AS event_id,
      'openvox_sms_dispatches'::text AS source_table,
      s.patient_id,
      'sms'::text AS canal,
      'SMS OpenVox'::text AS motivo,
      COALESCE(s.status, 'pendiente')::text AS resultado,
      (lower(COALESCE(s.status, '')) IN ('sent', 'delivered', 'enviado', 'entregado')) AS efectiva,
      0::INT AS duracion_segundos,
      s.created_at
    FROM public.openvox_sms_dispatches s
    JOIN public.patients p ON p.patient_id = s.patient_id
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id OR s.hospital_id = p_hospital_id)
  ),
  interaction_channel_events AS MATERIALIZED (
    SELECT
      i.id::text AS event_id,
      'interactions'::text AS source_table,
      i.patient_id,
      CASE
        WHEN lower(COALESCE(i.tipo, '')) ~ 'sms' THEN 'sms'
        WHEN lower(COALESCE(i.tipo, '')) ~ '(email|mail|correo)' THEN 'email'
        WHEN lower(COALESCE(i.tipo, '')) ~ '(what|wpp)' THEN 'whatsapp'
        WHEN lower(COALESCE(i.tipo, '')) ~ '(call|llamada|voz|vapi|tel)' THEN 'call'
        ELSE NULL
      END AS canal,
      COALESCE(i.asunto, i.tipo, 'Comunicación')::text AS motivo,
      COALESCE(i.estado, 'registrado')::text AS resultado,
      (lower(COALESCE(i.estado, '')) NOT IN ('fallido', 'failed', 'error', 'rechazado', 'no_contesta')) AS efectiva,
      0::INT AS duracion_segundos,
      i.created_at
    FROM public.interactions i
    JOIN public.patients p ON p.patient_id = i.patient_id
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND lower(COALESCE(i.tipo, '')) ~ '(sms|email|mail|correo|what|wpp|call|llamada|voz|vapi|tel)'
  ),
  patient_events AS MATERIALIZED (
    SELECT * FROM vapi_events WHERE canal IS NOT NULL
    UNION ALL
    SELECT * FROM evidence_events WHERE canal IS NOT NULL
    UNION ALL
    SELECT * FROM sms_events WHERE canal IS NOT NULL
    UNION ALL
    SELECT * FROM interaction_channel_events WHERE canal IS NOT NULL
  ),
  patient_events_agg AS MATERIALIZED (
    SELECT
      pe.patient_id,
      count(*) FILTER (WHERE pe.canal = 'sms' AND (pe.source_table <> 'openvox_sms_dispatches' OR pe.efectiva))::BIGINT AS ev_sms,
      count(*) FILTER (WHERE pe.canal = 'email')::BIGINT AS ev_email,
      count(*) FILTER (WHERE pe.canal = 'call')::BIGINT AS ev_call,
      count(*) FILTER (WHERE pe.canal = 'whatsapp')::BIGINT AS ev_whatsapp
    FROM patient_events pe
    GROUP BY pe.patient_id
  ),
  event_deltas AS MATERIALIZED (
    SELECT
      COALESCE(p.curso_vida, 'adultez') AS raw_curso,
      COALESCE(p.grupos_riesgo, '{}'::text[]) AS raw_riesgos,
      COALESCE(p.grupo_riesgo, '') AS raw_riesgo,
      CASE
        WHEN lower(COALESCE(p.zona, '')) LIKE 'rural%' THEN 'Rural'
        WHEN lower(COALESCE(p.zona, '')) LIKE 'urban%' THEN 'Urbana'
        ELSE ''
      END AS zona_norm,
      trim(COALESCE(NULLIF(p.comuna, ''), p.corregimiento, '')) AS comuna_lbl,
      trim(COALESCE(NULLIF(p.barrio, ''), p.vereda, '')) AS barrio_lbl,
      0::BIGINT AS cnt,
      GREATEST(pea.ev_sms - COALESCE((p.conteo_canales->>'sms')::INT, 0), 0)::BIGINT AS stored_sms,
      GREATEST(pea.ev_email - COALESCE((p.conteo_canales->>'email')::INT, 0), 0)::BIGINT AS stored_email,
      GREATEST(pea.ev_call - COALESCE((p.conteo_canales->>'call')::INT, 0), 0)::BIGINT AS stored_call,
      GREATEST(pea.ev_whatsapp - COALESCE((p.conteo_canales->>'whatsapp')::INT, 0), 0)::BIGINT AS stored_whatsapp
    FROM patient_events_agg pea
    JOIN public.patients p ON p.patient_id = pea.patient_id
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
  ),
  grouped AS MATERIALIZED (
    SELECT
      COALESCE(p.curso_vida, 'adultez') AS raw_curso,
      COALESCE(p.grupos_riesgo, '{}'::text[]) AS raw_riesgos,
      COALESCE(p.grupo_riesgo, '') AS raw_riesgo,
      CASE
        WHEN lower(COALESCE(p.zona, '')) LIKE 'rural%' THEN 'Rural'
        WHEN lower(COALESCE(p.zona, '')) LIKE 'urban%' THEN 'Urbana'
        ELSE ''
      END AS zona_norm,
      trim(COALESCE(NULLIF(p.comuna, ''), p.corregimiento, '')) AS comuna_lbl,
      trim(COALESCE(NULLIF(p.barrio, ''), p.vereda, '')) AS barrio_lbl,
      count(*)::BIGINT AS cnt,
      COALESCE(sum(CASE WHEN p.conteo_canales IS NOT NULL THEN COALESCE((p.conteo_canales->>'sms')::INT, 0) ELSE 0 END), 0)::BIGINT AS stored_sms,
      COALESCE(sum(CASE WHEN p.conteo_canales IS NOT NULL THEN COALESCE((p.conteo_canales->>'email')::INT, 0) ELSE 0 END), 0)::BIGINT AS stored_email,
      COALESCE(sum(CASE WHEN p.conteo_canales IS NOT NULL THEN COALESCE((p.conteo_canales->>'call')::INT, 0) ELSE 0 END), 0)::BIGINT AS stored_call,
      COALESCE(sum(CASE WHEN p.conteo_canales IS NOT NULL THEN COALESCE((p.conteo_canales->>'whatsapp')::INT, 0) ELSE 0 END), 0)::BIGINT AS stored_whatsapp
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
    GROUP BY 1, 2, 3, 4, 5, 6
  ),
  combined_groups AS (
    SELECT * FROM grouped
    UNION ALL
    SELECT * FROM event_deltas
    WHERE stored_sms > 0 OR stored_email > 0 OR stored_call > 0 OR stored_whatsapp > 0
  ),
  base_pts AS MATERIALIZED (
    SELECT
      public.curso_key_to_code_3280(g.raw_curso) AS curso_code,
      public.patient_riesgo_ids_3280(g.raw_riesgos, g.raw_riesgo, NULL) AS riesgo_ids,
      g.zona_norm,
      g.comuna_lbl,
      g.barrio_lbl,
      g.cnt,
      g.stored_sms,
      g.stored_email,
      g.stored_call,
      g.stored_whatsapp
    FROM combined_groups g
  ),
  por_curso AS (
    SELECT
      curso_code AS id,
      sum(cnt)::BIGINT AS total_censo,
      sum(stored_sms)::BIGINT AS sms,
      sum(stored_email)::BIGINT AS email,
      sum(stored_call)::BIGINT AS call,
      sum(stored_whatsapp)::BIGINT AS whatsapp
    FROM base_pts
    GROUP BY curso_code
  ),
  por_riesgo AS (
    SELECT
      rid AS id,
      sum(bp.cnt)::BIGINT AS total_censo,
      sum(bp.stored_sms)::BIGINT AS sms,
      sum(bp.stored_email)::BIGINT AS email,
      sum(bp.stored_call)::BIGINT AS call,
      sum(bp.stored_whatsapp)::BIGINT AS whatsapp
    FROM base_pts bp
    CROSS JOIN unnest(bp.riesgo_ids) AS rid
    WHERE rid BETWEEN 1 AND 11
    GROUP BY rid
  ),
  filtered AS (
    SELECT *
    FROM base_pts
    WHERE (p_curso_vida IS NULL OR p_curso_vida = 'todos' OR curso_code = upper(trim(p_curso_vida)))
      AND (p_grupo_riesgo IS NULL OR p_grupo_riesgo = 'todos' OR NULLIF(regexp_replace(p_grupo_riesgo, '\D', '', 'g'), '')::INT = ANY(riesgo_ids))
      AND (p_zona IS NULL OR p_zona = 'todos' OR lower(zona_norm) = lower(trim(p_zona)))
      AND (p_comuna IS NULL OR p_comuna = 'todos' OR p_comuna LIKE 'Todas%' OR comuna_lbl = p_comuna)
      AND (p_barrio IS NULL OR p_barrio = 'todos' OR p_barrio LIKE 'Todos%' OR barrio_lbl = p_barrio)
  ),
  comunas_list AS (
    SELECT COALESCE(jsonb_agg(comuna_lbl ORDER BY comuna_lbl), '[]'::jsonb) AS arr
    FROM (SELECT DISTINCT comuna_lbl FROM base_pts WHERE comuna_lbl <> '' LIMIT 300) s
  ),
  barrios_list AS (
    SELECT COALESCE(jsonb_agg(barrio_lbl ORDER BY barrio_lbl), '[]'::jsonb) AS arr
    FROM (SELECT DISTINCT barrio_lbl FROM base_pts WHERE barrio_lbl <> '' LIMIT 500) s
  ),
  campaign_eff AS (
    SELECT
      COALESCE(sum(COALESCE(entregados, 0)), 0)::BIGINT AS efectivas,
      COALESCE(sum(COALESCE(fallidos, 0)), 0)::BIGINT AS fallidas
    FROM public.campaigns
    WHERE (p_hospital_id IS NULL OR hospital_id = p_hospital_id)
  ),
  event_eff AS (
    SELECT
      count(*) FILTER (WHERE efectiva)::BIGINT AS efectivas,
      count(*) FILTER (WHERE NOT efectiva)::BIGINT AS fallidas
    FROM patient_events
  ),
  total_eff AS (
    SELECT
      ((SELECT efectivas FROM campaign_eff) + (SELECT efectivas FROM event_eff))::BIGINT AS efectivas,
      ((SELECT fallidas FROM campaign_eff) + (SELECT fallidas FROM event_eff))::BIGINT AS fallidas
  ),
  recent_comms AS (
    SELECT COALESCE(jsonb_agg(row_to_json(rc)), '[]'::jsonb) AS arr
    FROM (
      SELECT
        pe.event_id AS id,
        pe.source_table,
        pe.canal,
        pe.patient_id,
        p.name AS patient_name,
        p.document AS patient_document,
        COALESCE(p.tipo_documento, 'CC') AS tipo_documento,
        public.curso_key_to_code_3280(COALESCE(p.curso_vida, 'adultez')) AS curso_code,
        COALESCE(p.curso_vida, 'adultez') AS curso_vida,
        COALESCE(p.grupos_riesgo, '{}'::text[]) AS grupos_riesgo,
        p.grupo_riesgo,
        COALESCE(p.zona, '') AS zona,
        trim(COALESCE(NULLIF(p.comuna, ''), p.corregimiento, p.city, '')) AS ubicacion,
        pe.motivo,
        pe.resultado,
        pe.efectiva,
        pe.duracion_segundos,
        pe.created_at
      FROM patient_events pe
      JOIN public.patients p ON p.patient_id = pe.patient_id
      ORDER BY pe.created_at DESC NULLS LAST
      LIMIT 30
    ) rc
  )
  SELECT jsonb_build_object(
    'total_patients', COALESCE((SELECT sum(cnt)::BIGINT FROM base_pts), 0),
    'filtered_patients', COALESCE((SELECT sum(cnt)::BIGINT FROM filtered), 0),
    'por_curso', (SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) FROM por_curso c),
    'por_riesgo', (SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) FROM por_riesgo r),
    'comunas', (SELECT arr FROM comunas_list),
    'barrios', (SELECT arr FROM barrios_list),
    'filtered_channels', jsonb_build_object(
      'sms', COALESCE((SELECT sum(stored_sms)::BIGINT FROM filtered), 0),
      'email', COALESCE((SELECT sum(stored_email)::BIGINT FROM filtered), 0),
      'call', COALESCE((SELECT sum(stored_call)::BIGINT FROM filtered), 0),
      'whatsapp', COALESCE((SELECT sum(stored_whatsapp)::BIGINT FROM filtered), 0)
    ),
    'event_totals', jsonb_build_object('sms', 0, 'email', 0, 'call', 0, 'whatsapp', 0),
    'effectiveness', jsonb_build_object(
      'total', (SELECT efectivas + fallidas FROM total_eff),
      'efectivas', (SELECT efectivas FROM total_eff),
      'fallidas', (SELECT fallidas FROM total_eff),
      'pct_efectivas', (SELECT CASE WHEN (efectivas + fallidas) > 0 THEN round((efectivas::numeric * 100.0) / (efectivas + fallidas), 1) ELSE 0.0 END FROM total_eff),
      'pct_fallidas', (SELECT CASE WHEN (efectivas + fallidas) > 0 THEN round((fallidas::numeric * 100.0) / (efectivas + fallidas), 1) ELSE 0.0 END FROM total_eff)
    ),
    'recent_communications', (SELECT arr FROM recent_comms)
  ) INTO v_res;

  INSERT INTO public.cronograma_summary_cache (cache_key, payload, updated_at)
  VALUES (v_cache_key, v_res, NOW())
  ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reports_demanda_summary(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 12. RPC Facturación: Pacientes con conteo_canales > 0
CREATE OR REPLACE FUNCTION public.get_billing_nonzero_canales_patients(
  p_hospital_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 500
)
RETURNS SETOF public.patients
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
  SELECT p.*
  FROM public.patients p
  WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
    AND (
      (p.conteo_canales->>'sms')::int > 0
      OR (p.conteo_canales->>'email')::int > 0
      OR (p.conteo_canales->>'call')::int > 0
      OR (p.conteo_canales->>'whatsapp')::int > 0
    )
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 2000));
$$;

GRANT EXECUTE ON FUNCTION public.get_billing_nonzero_canales_patients(UUID, INT) TO anon, authenticated;

-- 13. RPC Keyset Compact Batch (incluye grupos_riesgo TEXT[] y DIVIPOLA Cali)
CREATE OR REPLACE FUNCTION public.get_patients_compact_batch(
  p_hospital_id UUID DEFAULT NULL,
  p_last_id UUID DEFAULT NULL,
  p_batch_size INT DEFAULT 5000
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_batch_size, 5000), 10000));
  v_total BIGINT := 0;
  v_rows JSONB := '[]'::jsonb;
  v_next_cursor UUID := NULL;
  v_cnt INT := 0;
BEGIN
  IF p_last_id IS NULL THEN
    SELECT count(*)::BIGINT
    INTO v_total
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id);
  END IF;

  WITH batch AS (
    SELECT
      p.patient_id, p.hospital_id, p.name, p.document, p.tipo_documento,
      p.phone, p.email, p.birthdate, p.sex, p.city, p.address, p.program,
      COALESCE(p.curso_vida, 'adultez'::varchar) AS curso_vida,
      p.grupo_riesgo, COALESCE(p.grupos_riesgo, '{}'::text[]) AS grupos_riesgo,
      p.zona, p.barrio, p.comuna, p.corregimiento, p.vereda, p.centro_poblado,
      p.eps, p.ips_asignada, p.tipo_usuario,
      p.doctor_id, s.doctor_name, s.doctor_email, p.created_at
    FROM public.patients p
    LEFT JOIN public.staff s ON s.doctor_id = p.doctor_id
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (p_last_id IS NULL OR p.patient_id > p_last_id)
    ORDER BY p.patient_id ASC
    LIMIT v_limit + 1
  ),
  sliced AS (
    SELECT * FROM batch LIMIT v_limit
  )
  SELECT
    COALESCE(jsonb_agg(row_to_json(sl) ORDER BY sl.patient_id), '[]'::jsonb),
    count(*)::INT,
    (SELECT patient_id FROM sliced ORDER BY patient_id DESC LIMIT 1)
  INTO v_rows, v_cnt, v_next_cursor
  FROM sliced sl;

  RETURN jsonb_build_object(
    'total', v_total,
    'count', v_cnt,
    'rows', v_rows,
    'next_cursor', v_next_cursor,
    'has_more', (v_cnt = v_limit AND v_next_cursor IS NOT NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patients_compact_batch(UUID, UUID, INT) TO anon, authenticated;

-- 14. RPC Demanda Mensual Res. 3280 (Opciones territoriales Cali + página cronológica con grupos_riesgo reales)
CREATE OR REPLACE FUNCTION public.get_demanda_filter_options(
  p_hospital_id UUID DEFAULT NULL,
  p_cursos TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_all_cursos BOOLEAN := (p_cursos IS NULL OR 'todos' = ANY(p_cursos));
  v_empty_cursos BOOLEAN := (p_cursos IS NOT NULL AND NOT ('todos' = ANY(p_cursos)) AND COALESCE(array_length(p_cursos, 1), 0) = 0);
  v_cache_key TEXT;
  v_cached JSONB;
  v_res JSONB;
  v_total_cohort BIGINT := 0;
  v_conteo_tipo JSONB := '{"Activo":0,"Nuevo":0,"Inactivo":0}'::jsonb;
  v_comunas JSONB := '[]'::jsonb;
  v_barrios_map JSONB := '{}'::jsonb;
  v_cps JSONB := '[]'::jsonb;
  v_corrs JSONB := '[]'::jsonb;
  v_veredas JSONB := '[]'::jsonb;
  v_veredas_por_corr JSONB := '{}'::jsonb;
  v_cps_por_corr JSONB := '{}'::jsonb;
BEGIN
  v_cache_key := 'dem_opts_v2:' || COALESCE(p_hospital_id::text, 'ALL') || ':' ||
    CASE WHEN v_all_cursos THEN 'ALL' ELSE COALESCE(array_to_string(ARRAY(SELECT unnest(p_cursos) ORDER BY 1), ','), 'EMPTY') END;

  SELECT payload INTO v_cached FROM public.cronograma_summary_cache WHERE cache_key = v_cache_key;
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_empty_cursos THEN
    RETURN jsonb_build_object(
      'total_cohort', 0,
      'conteo_por_tipo', v_conteo_tipo,
      'comunas', '[]'::jsonb,
      'barrios_por_comuna', '{}'::jsonb,
      'centros_poblados', '[]'::jsonb,
      'corregimientos', '[]'::jsonb,
      'veredas', '[]'::jsonb,
      'veredas_por_corregimiento', '{}'::jsonb,
      'centros_poblados_por_corregimiento', '{}'::jsonb
    );
  END IF;

  SELECT
    count(*)::BIGINT,
    jsonb_build_object(
      'Activo', count(*) FILTER (WHERE COALESCE(p.tipo_usuario, 'Activo') = 'Activo'),
      'Nuevo', count(*) FILTER (WHERE p.tipo_usuario = 'Nuevo'),
      'Inactivo', count(*) FILTER (WHERE p.tipo_usuario = 'Inactivo')
    )
  INTO v_total_cohort, v_conteo_tipo
  FROM public.patients p
  WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
    AND (v_all_cursos OR p.curso_vida = ANY(p_cursos));

  WITH urban AS (
    SELECT p.comuna, p.barrio
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (v_all_cursos OR p.curso_vida = ANY(p_cursos))
      AND COALESCE(p.zona, 'Urbana') = 'Urbana'
      AND p.comuna IS NOT NULL AND p.comuna <> ''
    GROUP BY p.comuna, p.barrio
  ),
  barrios_grouped AS (
    SELECT comuna, jsonb_agg(barrio ORDER BY barrio) AS barrios
    FROM urban
    WHERE barrio IS NOT NULL AND barrio <> ''
    GROUP BY comuna
  )
  SELECT
    COALESCE((SELECT jsonb_agg(DISTINCT comuna ORDER BY comuna) FROM urban), '[]'::jsonb),
    COALESCE((SELECT jsonb_object_agg(comuna, barrios) FROM barrios_grouped), '{}'::jsonb)
  INTO v_comunas, v_barrios_map;

  WITH rural AS (
    SELECT
      NULLIF(trim(p.corregimiento), '') AS corr,
      NULLIF(trim(p.vereda), '') AS ver,
      NULLIF(trim(p.centro_poblado), '') AS cp
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (v_all_cursos OR p.curso_vida = ANY(p_cursos))
      AND p.zona = 'Rural'
    GROUP BY 1, 2, 3
  ),
  v_by_c AS (
    SELECT corr, jsonb_agg(DISTINCT ver ORDER BY ver) AS arr
    FROM rural WHERE corr IS NOT NULL AND ver IS NOT NULL GROUP BY corr
  ),
  cp_by_c AS (
    SELECT corr, jsonb_agg(DISTINCT cp ORDER BY cp) AS arr
    FROM rural WHERE corr IS NOT NULL AND cp IS NOT NULL GROUP BY corr
  )
  SELECT
    COALESCE((SELECT jsonb_agg(DISTINCT cp ORDER BY cp) FROM rural WHERE cp IS NOT NULL), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(DISTINCT corr ORDER BY corr) FROM rural WHERE corr IS NOT NULL), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(DISTINCT ver ORDER BY ver) FROM rural WHERE ver IS NOT NULL), '[]'::jsonb),
    COALESCE((SELECT jsonb_object_agg(corr, arr) FROM v_by_c), '{}'::jsonb),
    COALESCE((SELECT jsonb_object_agg(corr, arr) FROM cp_by_c), '{}'::jsonb)
  INTO v_cps, v_corrs, v_veredas, v_veredas_por_corr, v_cps_por_corr;

  v_res := jsonb_build_object(
    'total_cohort', v_total_cohort,
    'conteo_por_tipo', v_conteo_tipo,
    'comunas', v_comunas,
    'barrios_por_comuna', v_barrios_map,
    'centros_poblados', v_cps,
    'corregimientos', v_corrs,
    'veredas', v_veredas,
    'veredas_por_corregimiento', v_veredas_por_corr,
    'centros_poblados_por_corregimiento', v_cps_por_corr
  );

  INSERT INTO public.cronograma_summary_cache (cache_key, payload, updated_at)
  VALUES (v_cache_key, v_res, NOW())
  ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_demanda_filter_options(UUID, TEXT[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_demanda_monthly_page(
  p_hospital_id UUID DEFAULT NULL,
  p_cursos TEXT[] DEFAULT NULL,
  p_zona TEXT DEFAULT 'todas',
  p_comuna TEXT DEFAULT 'todas',
  p_barrio TEXT DEFAULT 'todos',
  p_centro_poblado TEXT DEFAULT 'todos',
  p_corregimiento TEXT DEFAULT 'todos',
  p_vereda TEXT DEFAULT 'todos',
  p_grupo_riesgo TEXT DEFAULT 'todos',
  p_tipo_usuario TEXT DEFAULT 'todos',
  p_search TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_all_cursos BOOLEAN := (p_cursos IS NULL OR 'todos' = ANY(p_cursos));
  v_empty_cursos BOOLEAN := (p_cursos IS NOT NULL AND NOT ('todos' = ANY(p_cursos)) AND COALESCE(array_length(p_cursos, 1), 0) = 0);
  v_search TEXT := NULLIF(trim(COALESCE(p_search, '')), '');
  v_riesgo_txt TEXT := NULLIF(trim(COALESCE(p_grupo_riesgo, '')), '');
  v_riesgo_id INT := NULL;
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_page_size, 25), 500));
  v_offset INT := (GREATEST(1, COALESCE(p_page, 1)) - 1) * v_limit;
  v_filtered_count BIGINT := 0;
  v_rows JSONB := '[]'::jsonb;
BEGIN
  IF v_empty_cursos THEN
    RETURN jsonb_build_object('filtered_count', 0, 'rows', '[]'::jsonb);
  END IF;

  IF v_riesgo_txt IS NOT NULL AND lower(v_riesgo_txt) NOT IN ('todos', 'todas') THEN
    v_riesgo_id := COALESCE(
      NULLIF(substring(v_riesgo_txt FROM '^\s*([0-9]+)\.'), '')::INT,
      NULLIF(public.classify_riesgo_id_3280(v_riesgo_txt, NULL), 0)
    );
  END IF;

  SELECT count(*)::BIGINT
  INTO v_filtered_count
  FROM public.patients p
  WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
    AND (v_all_cursos OR p.curso_vida = ANY(p_cursos))
    AND (p_zona IS NULL OR lower(p_zona) IN ('todas', 'todos', '') OR COALESCE(p.zona, 'Urbana') = p_zona)
    AND (p_comuna IS NULL OR lower(p_comuna) IN ('todas', 'todos', '') OR p.comuna = p_comuna)
    AND (p_barrio IS NULL OR lower(p_barrio) IN ('todas', 'todos', '') OR p.barrio = p_barrio)
    AND (p_centro_poblado IS NULL OR lower(p_centro_poblado) IN ('todas', 'todos', '') OR p.centro_poblado = p_centro_poblado)
    AND (p_corregimiento IS NULL OR lower(p_corregimiento) IN ('todas', 'todos', '') OR p.corregimiento = p_corregimiento)
    AND (p_vereda IS NULL OR lower(p_vereda) IN ('todas', 'todos', '') OR p.vereda = p_vereda)
    AND (
      v_riesgo_txt IS NULL OR lower(v_riesgo_txt) IN ('todos', 'todas', '')
      OR (v_riesgo_id IS NOT NULL AND v_riesgo_id = ANY(public.patient_riesgo_ids_3280(p.grupos_riesgo, p.grupo_riesgo, p.program)))
      OR (v_riesgo_id IS NULL AND (
          lower(COALESCE(p.grupo_riesgo, '')) ILIKE '%' || lower(v_riesgo_txt) || '%'
          OR EXISTS (SELECT 1 FROM unnest(COALESCE(p.grupos_riesgo, '{}'::text[])) g WHERE lower(g) ILIKE '%' || lower(v_riesgo_txt) || '%')
      ))
    )
    AND (p_tipo_usuario IS NULL OR lower(p_tipo_usuario) IN ('todos', 'todas', '') OR COALESCE(p.tipo_usuario, 'Activo') = p_tipo_usuario)
    AND (
      v_search IS NULL
      OR p.name ILIKE '%' || v_search || '%'
      OR p.document ILIKE '%' || v_search || '%'
      OR p.phone ILIKE '%' || v_search || '%'
      OR p.historia_clinica_num ILIKE '%' || v_search || '%'
    );

  WITH paged AS (
    SELECT
      p.patient_id, p.name, p.document, COALESCE(p.tipo_documento, 'CC') AS tipo_documento,
      p.historia_clinica_num, p.phone, p.email, p.birthdate, p.sex, p.program,
      COALESCE(p.curso_vida, 'adultez') AS curso_vida,
      p.grupo_riesgo,
      COALESCE(p.grupos_riesgo, '{}'::text[]) AS grupos_riesgo,
      COALESCE(p.zona, 'Urbana') AS zona,
      p.comuna, p.barrio, p.centro_poblado, p.corregimiento, p.vereda,
      COALESCE(p.tipo_usuario, 'Activo') AS tipo_usuario,
      p.total_visitas_hospital, p.fecha_ingreso_hospital, p.ultima_visita_hospital,
      p.doctor_id,
      public.get_patient_priority_3280(p.curso_vida, p.grupos_riesgo, p.grupo_riesgo) AS prioridad_llamada,
      LEAST(GREATEST(COALESCE(EXTRACT(DAY FROM p.birthdate)::INT, 1), 1), 28) AS day_num
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (v_all_cursos OR p.curso_vida = ANY(p_cursos))
      AND (p_zona IS NULL OR lower(p_zona) IN ('todas', 'todos', '') OR COALESCE(p.zona, 'Urbana') = p_zona)
      AND (p_comuna IS NULL OR lower(p_comuna) IN ('todas', 'todos', '') OR p.comuna = p_comuna)
      AND (p_barrio IS NULL OR lower(p_barrio) IN ('todas', 'todos', '') OR p.barrio = p_barrio)
      AND (p_centro_poblado IS NULL OR lower(p_centro_poblado) IN ('todas', 'todos', '') OR p.centro_poblado = p_centro_poblado)
      AND (p_corregimiento IS NULL OR lower(p_corregimiento) IN ('todas', 'todos', '') OR p.corregimiento = p_corregimiento)
      AND (p_vereda IS NULL OR lower(p_vereda) IN ('todas', 'todos', '') OR p.vereda = p_vereda)
      AND (
        v_riesgo_txt IS NULL OR lower(v_riesgo_txt) IN ('todos', 'todas', '')
        OR (v_riesgo_id IS NOT NULL AND v_riesgo_id = ANY(public.patient_riesgo_ids_3280(p.grupos_riesgo, p.grupo_riesgo, p.program)))
        OR (v_riesgo_id IS NULL AND (
            lower(COALESCE(p.grupo_riesgo, '')) ILIKE '%' || lower(v_riesgo_txt) || '%'
            OR EXISTS (SELECT 1 FROM unnest(COALESCE(p.grupos_riesgo, '{}'::text[])) g WHERE lower(g) ILIKE '%' || lower(v_riesgo_txt) || '%')
        ))
      )
      AND (p_tipo_usuario IS NULL OR lower(p_tipo_usuario) IN ('todos', 'todas', '') OR COALESCE(p.tipo_usuario, 'Activo') = p_tipo_usuario)
      AND (
        v_search IS NULL
        OR p.name ILIKE '%' || v_search || '%'
        OR p.document ILIKE '%' || v_search || '%'
        OR p.phone ILIKE '%' || v_search || '%'
        OR p.historia_clinica_num ILIKE '%' || v_search || '%'
      )
    ORDER BY (LEAST(GREATEST(COALESCE(EXTRACT(DAY FROM p.birthdate)::INT, 1), 1), 28)) ASC, p.patient_id ASC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT COALESCE(jsonb_agg(row_to_json(pg)), '[]'::jsonb)
  INTO v_rows
  FROM paged pg;

  RETURN jsonb_build_object(
    'filtered_count', v_filtered_count,
    'rows', v_rows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_demanda_monthly_page(UUID, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, INT) TO anon, authenticated;

-- 15. Caché auto-invalidada por sentencia + RPC Cronograma Unificado Res. 3280 (7 Cursos A-G + 11 Grupos de Riesgo reales + Tope 500/día + Prioridad P1-P5)
CREATE TABLE IF NOT EXISTS public.cronograma_summary_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.invalidate_cronograma_summary_cache_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.cronograma_summary_cache;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_cronograma_cache ON public.patients;
CREATE TRIGGER trg_invalidate_cronograma_cache
  AFTER INSERT OR UPDATE OR DELETE ON public.patients
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.invalidate_cronograma_summary_cache_fn();

-- 11b. Invalidar caché de reportes/cronograma automáticamente ante cambios en tablas de comunicaciones o campañas
DO $$
DECLARE
  v_tbl TEXT;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY['ai_contact_evidence', 'vapi_agent_sessions', 'openvox_sms_dispatches', 'interactions', 'campaigns', 'campaign_messages']
  LOOP
    IF to_regclass('public.' || v_tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_invalidate_cache_%s ON public.%I;', v_tbl, v_tbl);
      EXECUTE format(
        'CREATE TRIGGER trg_invalidate_cache_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.invalidate_cronograma_summary_cache_fn();',
        v_tbl, v_tbl
      );
    END IF;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.get_cronograma_res3280_summary(UUID, TEXT[]);
DROP FUNCTION IF EXISTS public.get_cronograma_res3280_summary(UUID, TEXT[], INT);
CREATE OR REPLACE FUNCTION public.get_cronograma_res3280_summary(
  p_hospital_id UUID DEFAULT NULL,
  p_doctor_cursos TEXT[] DEFAULT NULL,
  p_year INT DEFAULT 2026
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_year INT := COALESCE(p_year, 2026);
  v_daily_cap INT := 500;
  v_all_cursos BOOLEAN := (p_doctor_cursos IS NULL OR 'todos' = ANY(p_doctor_cursos));
  v_empty_cursos BOOLEAN := (p_doctor_cursos IS NOT NULL AND NOT ('todos' = ANY(p_doctor_cursos)) AND COALESCE(array_length(p_doctor_cursos, 1), 0) = 0);
  v_cache_key TEXT;
  v_cached JSONB;
  v_result JSONB;
  v_total_censo BIGINT := 0;
  v_total_eligible BIGINT := 0;
  v_no_risk_count BIGINT := 0;
  v_censo_by_curso JSONB := '{}'::jsonb;
  v_censo_by_riesgo JSONB := '{}'::jsonb;
  v_cursos_matrix JSONB := '{}'::jsonb;
  v_riesgos_matrix JSONB := '{}'::jsonb;
  v_priority_matrix JSONB := '{}'::jsonb;
  v_daily_breakdown JSONB := '{}'::jsonb;
  v_holidays JSONB := '[]'::jsonb;
BEGIN
  v_cache_key := 'crono_v2:' || COALESCE(p_hospital_id::text, 'ALL') || ':' || v_year::text || ':' ||
    CASE WHEN v_all_cursos THEN 'ALL' ELSE COALESCE(array_to_string(ARRAY(SELECT unnest(p_doctor_cursos) ORDER BY 1), ','), 'EMPTY') END;

  SELECT payload INTO v_cached
  FROM public.cronograma_summary_cache
  WHERE cache_key = v_cache_key;

  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  SELECT COALESCE(jsonb_agg(to_char(d::date, 'YYYY-MM-DD') ORDER BY d::date), '[]'::jsonb)
  INTO v_holidays
  FROM generate_series(make_date(v_year, 1, 1), make_date(v_year, 12, 31), INTERVAL '1 day') AS d
  WHERE public.is_colombia_holiday(d::date);

  IF v_empty_cursos THEN
    RETURN jsonb_build_object(
      'year', v_year,
      'daily_cap', v_daily_cap,
      'total_patients', 0,
      'total_eligible_year', 0,
      'no_risk_count', 0,
      'censo_by_curso', '{}'::jsonb,
      'censo_by_riesgo', '{}'::jsonb,
      'cursos_matrix', '{}'::jsonb,
      'riesgos_matrix', '{}'::jsonb,
      'priority_matrix', '{}'::jsonb,
      'daily_breakdown', '{}'::jsonb,
      'holidays', v_holidays
    );
  END IF;

  WITH month_wd AS MATERIALIZED (
    SELECT m AS mnum,
           public.get_month_workdays_3280(v_year, m) AS wdays,
           GREATEST(1, COALESCE(array_length(public.get_month_workdays_3280(v_year, m), 1), 1)) AS wlen
    FROM generate_series(1, 12) AS m
  ),
  scoped AS MATERIALIZED (
    SELECT
      p.patient_id,
      CASE p.curso_vida
        WHEN 'primera_infancia' THEN 'A'
        WHEN 'infancia' THEN 'B'
        WHEN 'adolescencia' THEN 'C'
        WHEN 'juventud' THEN 'D'
        WHEN 'adultez' THEN 'E'
        WHEN 'vejez' THEN 'F'
        WHEN 'preventivo_mujer' THEN 'G'
        WHEN 'materno_perinatal' THEN 'G'
        ELSE 'E'
      END AS ccode,
      (
        CASE WHEN p.grupos_riesgo IS NOT NULL AND cardinality(p.grupos_riesgo) > 0 THEN
          (CASE WHEN 'Población Materno-Perinatal' = ANY(p.grupos_riesgo) THEN 1 ELSE 0 END)
          | (CASE WHEN 'Riesgo Cardiovascular, Metabólico y Renal' = ANY(p.grupos_riesgo) THEN 2 ELSE 0 END)
          | (CASE WHEN 'Cáncer (Detección temprana y seguimiento)' = ANY(p.grupos_riesgo) OR 'Cáncer' = ANY(p.grupos_riesgo) THEN 4 ELSE 0 END)
          | (CASE WHEN 'Enfermedades Respiratorias Crónicas' = ANY(p.grupos_riesgo) THEN 8 ELSE 0 END)
          | (CASE WHEN 'Salud Mental y Sustancias Psicoactivas' = ANY(p.grupos_riesgo) THEN 16 ELSE 0 END)
          | (CASE WHEN 'Enfermedades Infecciosas y Zoonóticas' = ANY(p.grupos_riesgo) THEN 32 ELSE 0 END)
          | (CASE WHEN 'Alteraciones Nutricionales y del Crecimiento' = ANY(p.grupos_riesgo) THEN 64 ELSE 0 END)
          | (CASE WHEN 'Enfermedades Huérfanas y Neurológicas' = ANY(p.grupos_riesgo) THEN 128 ELSE 0 END)
          | (CASE WHEN 'Planificación Familiar' = ANY(p.grupos_riesgo) THEN 256 ELSE 0 END)
          | (CASE WHEN 'Vacunación PAI' = ANY(p.grupos_riesgo) THEN 512 ELSE 0 END)
          | (CASE WHEN 'Salud Oral' = ANY(p.grupos_riesgo) THEN 1024 ELSE 0 END)
        ELSE 0 END
      ) AS rmask,
      COALESCE(EXTRACT(MONTH FROM p.birthdate)::INT, 1) AS mnum,
      p.birthdate,
      p.sex
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (v_all_cursos OR p.curso_vida = ANY(p_doctor_cursos))
  ),
  elig AS MATERIALIZED (
    SELECT
      s.ccode,
      s.rmask,
      s.mnum,
      CASE
        WHEN s.ccode = 'G' OR (s.rmask & 1) <> 0 THEN 1
        WHEN (s.rmask & 4) <> 0 THEN 2
        WHEN s.ccode = 'A' AND s.rmask <> 0 THEN 3
        WHEN s.rmask <> 0 THEN 4
        ELSE 5
      END AS prio,
      mw.wdays[(abs(hashtext(s.patient_id::text)) % mw.wlen) + 1] AS assigned_date
    FROM scoped s
    JOIN month_wd mw ON mw.mnum = s.mnum
    WHERE s.ccode IN ('A','B','C','G')
       OR s.rmask <> 0
       OR (
         s.birthdate IS NOT NULL AND (
           (s.ccode = 'D' AND (
             GREATEST(0, v_year - EXTRACT(YEAR FROM s.birthdate)::INT) IN (20, 26)
             OR (upper(left(coalesce(s.sex, ''), 1)) = 'F' AND GREATEST(0, v_year - EXTRACT(YEAR FROM s.birthdate)::INT) IN (25, 28))
           ))
           OR (s.ccode = 'E' AND (
             GREATEST(0, v_year - EXTRACT(YEAR FROM s.birthdate)::INT) IN (29, 34, 39, 44, 49, 52, 55, 58)
             OR (GREATEST(0, v_year - EXTRACT(YEAR FROM s.birthdate)::INT) >= 50 AND GREATEST(0, v_year - EXTRACT(YEAR FROM s.birthdate)::INT) % 2 = 0)
           ))
           OR (s.ccode = 'F' AND GREATEST(0, v_year - EXTRACT(YEAR FROM s.birthdate)::INT) >= 60 AND ((GREATEST(0, v_year - EXTRACT(YEAR FROM s.birthdate)::INT) - 60) % 3 = 0))
         )
       )
  ),
  censo_c AS (
    SELECT ccode, count(*)::BIGINT AS cnt FROM scoped GROUP BY ccode
  ),
  censo_r_row AS (
    SELECT
      count(*) FILTER (WHERE (rmask & 1) <> 0)::BIGINT AS r1,
      count(*) FILTER (WHERE (rmask & 2) <> 0)::BIGINT AS r2,
      count(*) FILTER (WHERE (rmask & 4) <> 0)::BIGINT AS r3,
      count(*) FILTER (WHERE (rmask & 8) <> 0)::BIGINT AS r4,
      count(*) FILTER (WHERE (rmask & 16) <> 0)::BIGINT AS r5,
      count(*) FILTER (WHERE (rmask & 32) <> 0)::BIGINT AS r6,
      count(*) FILTER (WHERE (rmask & 64) <> 0)::BIGINT AS r7,
      count(*) FILTER (WHERE (rmask & 128) <> 0)::BIGINT AS r8,
      count(*) FILTER (WHERE (rmask & 256) <> 0)::BIGINT AS r9,
      count(*) FILTER (WHERE (rmask & 512) <> 0)::BIGINT AS r10,
      count(*) FILTER (WHERE (rmask & 1024) <> 0)::BIGINT AS r11
    FROM scoped
  ),
  c_month AS (
    SELECT ccode, mnum, count(*)::BIGINT AS cnt FROM elig GROUP BY ccode, mnum
  ),
  r_month_wide AS (
    SELECT
      mnum,
      count(*) FILTER (WHERE (rmask & 1) <> 0)::BIGINT AS r1,
      count(*) FILTER (WHERE (rmask & 2) <> 0)::BIGINT AS r2,
      count(*) FILTER (WHERE (rmask & 4) <> 0)::BIGINT AS r3,
      count(*) FILTER (WHERE (rmask & 8) <> 0)::BIGINT AS r4,
      count(*) FILTER (WHERE (rmask & 16) <> 0)::BIGINT AS r5,
      count(*) FILTER (WHERE (rmask & 32) <> 0)::BIGINT AS r6,
      count(*) FILTER (WHERE (rmask & 64) <> 0)::BIGINT AS r7,
      count(*) FILTER (WHERE (rmask & 128) <> 0)::BIGINT AS r8,
      count(*) FILTER (WHERE (rmask & 256) <> 0)::BIGINT AS r9,
      count(*) FILTER (WHERE (rmask & 512) <> 0)::BIGINT AS r10,
      count(*) FILTER (WHERE (rmask & 1024) <> 0)::BIGINT AS r11
    FROM elig
    GROUP BY mnum
  ),
  p_month AS (
    SELECT prio, mnum, count(*)::BIGINT AS cnt FROM elig GROUP BY prio, mnum
  ),
  day_agg AS (
    SELECT
      assigned_date,
      jsonb_build_object(
        'total', count(*)::INT,
        'llamadas', LEAST(count(*)::INT, v_daily_cap),
        'sms', GREATEST(0, count(*)::INT - v_daily_cap),
        'cursos', jsonb_strip_nulls(jsonb_build_object(
          'A', NULLIF(count(*) FILTER (WHERE ccode='A'), 0),
          'B', NULLIF(count(*) FILTER (WHERE ccode='B'), 0),
          'C', NULLIF(count(*) FILTER (WHERE ccode='C'), 0),
          'D', NULLIF(count(*) FILTER (WHERE ccode='D'), 0),
          'E', NULLIF(count(*) FILTER (WHERE ccode='E'), 0),
          'F', NULLIF(count(*) FILTER (WHERE ccode='F'), 0),
          'G', NULLIF(count(*) FILTER (WHERE ccode='G'), 0)
        )),
        'riesgos', jsonb_strip_nulls(jsonb_build_object(
          '1', NULLIF(count(*) FILTER (WHERE (rmask & 1) <> 0), 0),
          '2', NULLIF(count(*) FILTER (WHERE (rmask & 2) <> 0), 0),
          '3', NULLIF(count(*) FILTER (WHERE (rmask & 4) <> 0), 0),
          '4', NULLIF(count(*) FILTER (WHERE (rmask & 8) <> 0), 0),
          '5', NULLIF(count(*) FILTER (WHERE (rmask & 16) <> 0), 0),
          '6', NULLIF(count(*) FILTER (WHERE (rmask & 32) <> 0), 0),
          '7', NULLIF(count(*) FILTER (WHERE (rmask & 64) <> 0), 0),
          '8', NULLIF(count(*) FILTER (WHERE (rmask & 128) <> 0), 0),
          '9', NULLIF(count(*) FILTER (WHERE (rmask & 256) <> 0), 0),
          '10', NULLIF(count(*) FILTER (WHERE (rmask & 512) <> 0), 0),
          '11', NULLIF(count(*) FILTER (WHERE (rmask & 1024) <> 0), 0)
        )),
        'priorities', jsonb_strip_nulls(jsonb_build_object(
          '1', NULLIF(count(*) FILTER (WHERE prio=1), 0),
          '2', NULLIF(count(*) FILTER (WHERE prio=2), 0),
          '3', NULLIF(count(*) FILTER (WHERE prio=3), 0),
          '4', NULLIF(count(*) FILTER (WHERE prio=4), 0),
          '5', NULLIF(count(*) FILTER (WHERE prio=5), 0)
        ))
      ) AS day_obj
    FROM elig
    GROUP BY assigned_date
  )
  SELECT
    (SELECT count(*)::BIGINT FROM scoped),
    (SELECT count(*)::BIGINT FROM elig),
    (SELECT count(*)::BIGINT FROM scoped WHERE rmask = 0),
    COALESCE((SELECT jsonb_object_agg(ccode, cnt) FROM censo_c), '{}'::jsonb),
    (SELECT jsonb_build_object(
      '1', r1, '2', r2, '3', r3, '4', r4, '5', r5, '6', r6,
      '7', r7, '8', r8, '9', r9, '10', r10, '11', r11
    ) FROM censo_r_row),
    COALESCE((SELECT jsonb_object_agg(ccode, months_arr) FROM (
      SELECT c.c_val AS ccode, jsonb_agg(COALESCE(cm.cnt, 0) ORDER BY m.m_val) AS months_arr
      FROM unnest(ARRAY['A','B','C','D','E','F','G']) AS c(c_val)
      CROSS JOIN generate_series(1, 12) AS m(m_val)
      LEFT JOIN c_month cm ON cm.ccode = c.c_val AND cm.mnum = m.m_val
      GROUP BY c.c_val
    ) x), '{}'::jsonb),
    (SELECT jsonb_build_object(
      '1',  (SELECT jsonb_agg(COALESCE(rw.r1,  0) ORDER BY m.m_val) FROM generate_series(1,12) m(m_val) LEFT JOIN r_month_wide rw ON rw.mnum = m.m_val),
      '2',  (SELECT jsonb_agg(COALESCE(rw.r2,  0) ORDER BY m.m_val) FROM generate_series(1,12) m(m_val) LEFT JOIN r_month_wide rw ON rw.mnum = m.m_val),
      '3',  (SELECT jsonb_agg(COALESCE(rw.r3,  0) ORDER BY m.m_val) FROM generate_series(1,12) m(m_val) LEFT JOIN r_month_wide rw ON rw.mnum = m.m_val),
      '4',  (SELECT jsonb_agg(COALESCE(rw.r4,  0) ORDER BY m.m_val) FROM generate_series(1,12) m(m_val) LEFT JOIN r_month_wide rw ON rw.mnum = m.m_val),
      '5',  (SELECT jsonb_agg(COALESCE(rw.r5,  0) ORDER BY m.m_val) FROM generate_series(1,12) m(m_val) LEFT JOIN r_month_wide rw ON rw.mnum = m.m_val),
      '6',  (SELECT jsonb_agg(COALESCE(rw.r6,  0) ORDER BY m.m_val) FROM generate_series(1,12) m(m_val) LEFT JOIN r_month_wide rw ON rw.mnum = m.m_val),
      '7',  (SELECT jsonb_agg(COALESCE(rw.r7,  0) ORDER BY m.m_val) FROM generate_series(1,12) m(m_val) LEFT JOIN r_month_wide rw ON rw.mnum = m.m_val),
      '8',  (SELECT jsonb_agg(COALESCE(rw.r8,  0) ORDER BY m.m_val) FROM generate_series(1,12) m(m_val) LEFT JOIN r_month_wide rw ON rw.mnum = m.m_val),
      '9',  (SELECT jsonb_agg(COALESCE(rw.r9,  0) ORDER BY m.m_val) FROM generate_series(1,12) m(m_val) LEFT JOIN r_month_wide rw ON rw.mnum = m.m_val),
      '10', (SELECT jsonb_agg(COALESCE(rw.r10, 0) ORDER BY m.m_val) FROM generate_series(1,12) m(m_val) LEFT JOIN r_month_wide rw ON rw.mnum = m.m_val),
      '11', (SELECT jsonb_agg(COALESCE(rw.r11, 0) ORDER BY m.m_val) FROM generate_series(1,12) m(m_val) LEFT JOIN r_month_wide rw ON rw.mnum = m.m_val)
    )),
    COALESCE((SELECT jsonb_object_agg(pkey, months_arr) FROM (
      SELECT pr.p_val::text AS pkey, jsonb_agg(COALESCE(pm.cnt, 0) ORDER BY m.m_val) AS months_arr
      FROM generate_series(1, 5) AS pr(p_val)
      CROSS JOIN generate_series(1, 12) AS m(m_val)
      LEFT JOIN p_month pm ON pm.prio = pr.p_val AND pm.mnum = m.m_val
      GROUP BY pr.p_val
    ) z), '{}'::jsonb),
    COALESCE((SELECT jsonb_object_agg(to_char(assigned_date, 'YYYY-MM-DD'), day_obj) FROM day_agg), '{}'::jsonb)
  INTO
    v_total_censo,
    v_total_eligible,
    v_no_risk_count,
    v_censo_by_curso,
    v_censo_by_riesgo,
    v_cursos_matrix,
    v_riesgos_matrix,
    v_priority_matrix,
    v_daily_breakdown;

  v_result := jsonb_build_object(
    'year', v_year,
    'daily_cap', v_daily_cap,
    'total_patients', v_total_censo,
    'total_eligible_year', v_total_eligible,
    'no_risk_count', v_no_risk_count,
    'censo_by_curso', v_censo_by_curso,
    'censo_by_riesgo', v_censo_by_riesgo,
    'cursos_matrix', v_cursos_matrix,
    'riesgos_matrix', v_riesgos_matrix,
    'priority_matrix', v_priority_matrix,
    'daily_breakdown', v_daily_breakdown,
    'holidays', v_holidays
  );

  INSERT INTO public.cronograma_summary_cache (cache_key, payload, updated_at)
  VALUES (v_cache_key, v_result, NOW())
  ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cronograma_res3280_summary(UUID, TEXT[], INT) TO anon, authenticated;

-- 15b. RPC Detalle Exacto de Pacientes por Día del Cronograma (con Prioridad P1-P5, Tope 500 IA + SMS Respaldo y Paginación)
CREATE OR REPLACE FUNCTION public.get_cronograma_day_patients_paginated(
  p_hospital_id UUID DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE,
  p_filter_type TEXT DEFAULT 'all',
  p_item_key TEXT DEFAULT NULL,
  p_doctor_cursos TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM p_date)::INT;
  v_month INT := EXTRACT(MONTH FROM p_date)::INT;
  v_wdays DATE[] := public.get_month_workdays_3280(v_year, v_month);
  v_wlen INT := COALESCE(array_length(v_wdays, 1), 0);
  v_day_pos INT := COALESCE(array_position(v_wdays, p_date), 0);
  v_daily_cap INT := 500;
  v_all_cursos BOOLEAN := (p_doctor_cursos IS NULL OR 'todos' = ANY(p_doctor_cursos));
  v_empty_cursos BOOLEAN := (p_doctor_cursos IS NOT NULL AND NOT ('todos' = ANY(p_doctor_cursos)) AND COALESCE(array_length(p_doctor_cursos, 1), 0) = 0);
  v_search TEXT := NULLIF(trim(COALESCE(p_search, '')), '');
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_page_size, 25), 200));
  v_offset INT := (GREATEST(1, COALESCE(p_page, 1)) - 1) * v_limit;
  v_filter_cursos TEXT[] := CASE WHEN p_filter_type = 'curso_vida' AND p_item_key IS NOT NULL THEN public.code_to_curso_keys_3280(p_item_key) ELSE NULL END;
  v_filter_rid INT := CASE WHEN p_filter_type = 'grupo_riesgo' AND p_item_key IS NOT NULL THEN COALESCE(NULLIF(regexp_replace(p_item_key, '\D', '', 'g'), '')::INT, 0) ELSE 0 END;
  v_day_total_all INT := 0;
  v_filtered_total BIGINT := 0;
  v_prio_counts JSONB := '{}'::jsonb;
  v_rows JSONB := '[]'::jsonb;
BEGIN
  IF v_empty_cursos OR v_wlen = 0 OR v_day_pos = 0 THEN
    RETURN jsonb_build_object(
      'date', to_char(p_date, 'YYYY-MM-DD'),
      'daily_cap', v_daily_cap,
      'day_total_all', 0,
      'llamadas_ia', 0,
      'sms_respaldo', 0,
      'total_count', 0,
      'priority_counts', '{}'::jsonb,
      'rows', '[]'::jsonb
    );
  END IF;

  WITH day_pool AS MATERIALIZED (
    SELECT
      p.patient_id,
      p.name,
      p.document,
      COALESCE(p.tipo_documento, 'CC') AS tipo_documento,
      p.phone,
      p.email,
      p.birthdate,
      GREATEST(0, v_year - EXTRACT(YEAR FROM p.birthdate)::INT) AS edad,
      p.sex,
      p.city,
      p.zona,
      p.comuna,
      p.barrio,
      p.corregimiento,
      p.vereda,
      p.centro_poblado,
      p.program,
      COALESCE(p.curso_vida, 'adultez') AS curso_vida,
      CASE p.curso_vida
        WHEN 'primera_infancia' THEN 'A'
        WHEN 'infancia' THEN 'B'
        WHEN 'adolescencia' THEN 'C'
        WHEN 'juventud' THEN 'D'
        WHEN 'adultez' THEN 'E'
        WHEN 'vejez' THEN 'F'
        WHEN 'preventivo_mujer' THEN 'G'
        WHEN 'materno_perinatal' THEN 'G'
        ELSE 'E'
      END AS curso_code,
      p.grupo_riesgo,
      COALESCE(p.grupos_riesgo, '{}'::text[]) AS grupos_riesgo,
      public.patient_riesgo_ids_3280(p.grupos_riesgo, p.grupo_riesgo, p.program) AS riesgo_ids,
      CASE
        WHEN p.curso_vida IN ('preventivo_mujer', 'materno_perinatal')
             OR 'Población Materno-Perinatal' = ANY(COALESCE(p.grupos_riesgo, '{}'::text[])) THEN 1
        WHEN 'Cáncer (Detección temprana y seguimiento)' = ANY(COALESCE(p.grupos_riesgo, '{}'::text[]))
             OR 'Cáncer' = ANY(COALESCE(p.grupos_riesgo, '{}'::text[])) THEN 2
        WHEN p.curso_vida = 'primera_infancia'
             AND p.grupos_riesgo IS NOT NULL AND cardinality(p.grupos_riesgo) > 0 THEN 3
        WHEN p.grupos_riesgo IS NOT NULL AND cardinality(p.grupos_riesgo) > 0 THEN 4
        ELSE 5
      END AS prioridad_llamada
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (v_all_cursos OR p.curso_vida = ANY(p_doctor_cursos))
      AND COALESCE(EXTRACT(MONTH FROM p.birthdate)::INT, 1) = v_month
      AND ((abs(hashtext(p.patient_id::text)) % v_wlen) + 1) = v_day_pos
      AND (
        p.curso_vida IN ('primera_infancia', 'infancia', 'adolescencia', 'preventivo_mujer', 'materno_perinatal')
        OR (p.grupos_riesgo IS NOT NULL AND cardinality(p.grupos_riesgo) > 0)
        OR (
          p.birthdate IS NOT NULL AND (
            (p.curso_vida = 'juventud' AND (
              GREATEST(0, v_year - EXTRACT(YEAR FROM p.birthdate)::INT) IN (20, 26)
              OR (upper(left(coalesce(p.sex, ''), 1)) = 'F' AND GREATEST(0, v_year - EXTRACT(YEAR FROM p.birthdate)::INT) IN (25, 28))
            ))
            OR (p.curso_vida = 'adultez' AND (
              GREATEST(0, v_year - EXTRACT(YEAR FROM p.birthdate)::INT) IN (29, 34, 39, 44, 49, 52, 55, 58)
              OR (GREATEST(0, v_year - EXTRACT(YEAR FROM p.birthdate)::INT) >= 50 AND GREATEST(0, v_year - EXTRACT(YEAR FROM p.birthdate)::INT) % 2 = 0)
            ))
            OR (p.curso_vida = 'vejez' AND GREATEST(0, v_year - EXTRACT(YEAR FROM p.birthdate)::INT) >= 60 AND ((GREATEST(0, v_year - EXTRACT(YEAR FROM p.birthdate)::INT) - 60) % 3 = 0))
          )
        )
      )
  ),
  ranked AS MATERIALIZED (
    SELECT
      dp.*,
      row_number() OVER (ORDER BY dp.prioridad_llamada ASC, dp.patient_id ASC) AS global_rank
    FROM day_pool dp
  ),
  filtered AS MATERIALIZED (
    SELECT
      r.*,
      CASE WHEN r.global_rank <= v_daily_cap THEN 'Llamada IA (Voz)' ELSE 'SMS Respaldo (R1-04)' END AS canal_asignado,
      act.accion AS accion_3280,
      act.cups AS cups_3280
    FROM ranked r
    CROSS JOIN LATERAL public.get_patient_res3280_action(r.birthdate, r.sex, r.curso_vida, r.grupos_riesgo, r.grupo_riesgo, v_year) AS act
    WHERE (v_filter_cursos IS NULL OR r.curso_vida = ANY(v_filter_cursos))
      AND (v_filter_rid = 0 OR v_filter_rid = ANY(r.riesgo_ids))
      AND (
        v_search IS NULL
        OR r.name ILIKE '%' || v_search || '%'
        OR r.document ILIKE '%' || v_search || '%'
        OR r.phone ILIKE '%' || v_search || '%'
      )
  ),
  prio_agg AS (
    SELECT COALESCE(jsonb_object_agg(prioridad_llamada::text, cnt), '{}'::jsonb) AS obj
    FROM (SELECT prioridad_llamada, count(*)::INT AS cnt FROM filtered GROUP BY prioridad_llamada) x
  ),
  paged AS (
    SELECT *
    FROM filtered
    ORDER BY prioridad_llamada ASC, global_rank ASC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT count(*)::INT FROM ranked),
    (SELECT count(*)::BIGINT FROM filtered),
    (SELECT obj FROM prio_agg),
    COALESCE((SELECT jsonb_agg(row_to_json(pg) ORDER BY pg.prioridad_llamada ASC, pg.global_rank ASC) FROM paged pg), '[]'::jsonb)
  INTO v_day_total_all, v_filtered_total, v_prio_counts, v_rows;

  RETURN jsonb_build_object(
    'date', to_char(p_date, 'YYYY-MM-DD'),
    'daily_cap', v_daily_cap,
    'day_total_all', v_day_total_all,
    'llamadas_ia', LEAST(v_day_total_all, v_daily_cap),
    'sms_respaldo', GREATEST(0, v_day_total_all - v_daily_cap),
    'total_count', v_filtered_total,
    'priority_counts', v_prio_counts,
    'rows', v_rows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cronograma_day_patients_paginated(UUID, DATE, TEXT, TEXT, TEXT[], TEXT, INT, INT) TO anon, authenticated;

-- 15c. RPC Cohorte Paginada del Cronograma + Filtros de Ubicación DIVIPOLA Cali (Paso 4 del Wizard)
DROP FUNCTION IF EXISTS public.get_cronograma_cohort_paginated(UUID, TEXT, TEXT, INT, TEXT[], TEXT[], TEXT, INT, INT);
DROP FUNCTION IF EXISTS public.get_cronograma_cohort_paginated(UUID, TEXT, TEXT, INT, TEXT[], TEXT[], TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT);
CREATE OR REPLACE FUNCTION public.get_cronograma_cohort_paginated(
  p_hospital_id UUID DEFAULT NULL,
  p_type TEXT DEFAULT 'curso_vida',
  p_item_key TEXT DEFAULT 'A',
  p_month INT DEFAULT NULL,
  p_cross_items TEXT[] DEFAULT NULL,
  p_doctor_cursos TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25,
  p_zona TEXT DEFAULT NULL,
  p_comuna TEXT DEFAULT NULL,
  p_barrio TEXT DEFAULT NULL,
  p_corregimiento TEXT DEFAULT NULL,
  p_vereda TEXT DEFAULT NULL,
  p_centro_poblado TEXT DEFAULT NULL,
  p_year INT DEFAULT 2026
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_year INT := COALESCE(p_year, 2026);
  v_all_cursos BOOLEAN := (p_doctor_cursos IS NULL OR 'todos' = ANY(p_doctor_cursos));
  v_empty_cursos BOOLEAN := (p_doctor_cursos IS NOT NULL AND NOT ('todos' = ANY(p_doctor_cursos)) AND COALESCE(array_length(p_doctor_cursos, 1), 0) = 0);
  v_search TEXT := NULLIF(trim(COALESCE(p_search, '')), '');
  v_zona TEXT := NULLIF(trim(COALESCE(p_zona, '')), '');
  v_comuna TEXT := NULLIF(trim(COALESCE(p_comuna, '')), '');
  v_barrio TEXT := NULLIF(trim(COALESCE(p_barrio, '')), '');
  v_corr TEXT := NULLIF(trim(COALESCE(p_corregimiento, '')), '');
  v_vereda TEXT := NULLIF(trim(COALESCE(p_vereda, '')), '');
  v_cp TEXT := NULLIF(trim(COALESCE(p_centro_poblado, '')), '');
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_page_size, 25), 500));
  v_offset INT := (GREATEST(1, COALESCE(p_page, 1)) - 1) * v_limit;
  v_primary_cursos TEXT[] := public.code_to_curso_keys_3280(p_item_key);
  v_primary_rid INT := COALESCE(NULLIF(regexp_replace(COALESCE(p_item_key, ''), '\D', '', 'g'), '')::INT, 0);
  v_cross_rids INT[] := NULL;
  v_cross_cursos TEXT[] := NULL;
  v_total BIGINT := 0;
  v_rows JSONB := '[]'::jsonb;
BEGIN
  IF v_empty_cursos THEN
    RETURN jsonb_build_object('total_count', 0, 'rows', '[]'::jsonb);
  END IF;

  IF lower(COALESCE(v_zona, '')) IN ('todas', 'todos', '') THEN v_zona := NULL; END IF;
  IF lower(COALESCE(v_comuna, '')) IN ('todas', 'todos', '') THEN v_comuna := NULL; END IF;
  IF lower(COALESCE(v_barrio, '')) IN ('todas', 'todos', '') THEN v_barrio := NULL; END IF;
  IF lower(COALESCE(v_corr, '')) IN ('todas', 'todos', '') THEN v_corr := NULL; END IF;
  IF lower(COALESCE(v_vereda, '')) IN ('todas', 'todos', '') THEN v_vereda := NULL; END IF;
  IF lower(COALESCE(v_cp, '')) IN ('todas', 'todos', '') THEN v_cp := NULL; END IF;

  IF p_cross_items IS NOT NULL AND array_length(p_cross_items, 1) > 0 THEN
    IF p_type = 'curso_vida' THEN
      SELECT array_agg(DISTINCT rid)
      INTO v_cross_rids
      FROM (
        SELECT public.classify_riesgo_id_3280(x, NULL) AS rid
        FROM unnest(p_cross_items) AS x
      ) s
      WHERE rid > 0;
    ELSE
      SELECT array_agg(DISTINCT ck)
      INTO v_cross_cursos
      FROM unnest(p_cross_items) AS x
      CROSS JOIN unnest(public.code_to_curso_keys_3280(x)) AS ck;
    END IF;
  END IF;

  WITH matched AS (
    SELECT
      p.patient_id, p.name, p.document, COALESCE(p.tipo_documento, 'CC') AS tipo_documento,
      p.phone, p.email, p.birthdate,
      GREATEST(0, v_year - EXTRACT(YEAR FROM p.birthdate)::INT) AS edad,
      p.sex, p.city, p.zona, p.comuna, p.barrio, p.corregimiento, p.vereda, p.centro_poblado,
      p.program,
      COALESCE(p.curso_vida, 'adultez') AS curso_vida,
      p.grupo_riesgo,
      COALESCE(p.grupos_riesgo, '{}'::text[]) AS grupos_riesgo,
      p.doctor_id,
      public.get_patient_priority_3280(p.curso_vida, p.grupos_riesgo, p.grupo_riesgo) AS prioridad_llamada
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (v_all_cursos OR p.curso_vida = ANY(p_doctor_cursos))
      AND public.is_patient_eligible_res3280(p.birthdate, p.sex, p.curso_vida, p.grupos_riesgo, p.grupo_riesgo, v_year)
      AND (p_month IS NULL OR COALESCE(EXTRACT(MONTH FROM p.birthdate)::INT, 1) = p_month)
      AND (
        (p_type = 'curso_vida'
          AND p.curso_vida = ANY(v_primary_cursos)
          AND (v_cross_rids IS NULL OR public.patient_riesgo_ids_3280(p.grupos_riesgo, p.grupo_riesgo, p.program) && v_cross_rids))
        OR
        (p_type <> 'curso_vida'
          AND v_primary_rid = ANY(public.patient_riesgo_ids_3280(p.grupos_riesgo, p.grupo_riesgo, p.program))
          AND (v_cross_cursos IS NULL OR p.curso_vida = ANY(v_cross_cursos)))
      )
      AND (v_zona IS NULL OR lower(COALESCE(p.zona, 'Urbana')) = lower(v_zona))
      AND (v_comuna IS NULL OR lower(COALESCE(p.comuna, '')) = lower(v_comuna))
      AND (v_barrio IS NULL OR lower(COALESCE(p.barrio, '')) = lower(v_barrio))
      AND (v_corr IS NULL OR lower(COALESCE(p.corregimiento, '')) = lower(v_corr))
      AND (v_vereda IS NULL OR lower(COALESCE(p.vereda, '')) = lower(v_vereda))
      AND (v_cp IS NULL OR lower(COALESCE(p.centro_poblado, '')) = lower(v_cp))
      AND (
        v_search IS NULL
        OR p.name ILIKE '%' || v_search || '%'
        OR p.document ILIKE '%' || v_search || '%'
        OR p.phone ILIKE '%' || v_search || '%'
      )
  ),
  paged AS (
    SELECT
      m.*,
      act.accion AS accion_3280,
      act.cups AS cups_3280
    FROM matched m
    CROSS JOIN LATERAL public.get_patient_res3280_action(m.birthdate, m.sex, m.curso_vida, m.grupos_riesgo, m.grupo_riesgo, v_year) AS act
    ORDER BY m.prioridad_llamada ASC, m.name ASC, m.patient_id ASC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT count(*)::BIGINT FROM matched),
    COALESCE((SELECT jsonb_agg(row_to_json(pg) ORDER BY pg.prioridad_llamada ASC, pg.name ASC, pg.patient_id ASC) FROM paged pg), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total_count', v_total, 'rows', v_rows);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cronograma_cohort_paginated(UUID, TEXT, TEXT, INT, TEXT[], TEXT[], TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT) TO anon, authenticated;

-- 16. Helpers y RPCs de Segmentación Exacta sobre 142k+ pacientes
CREATE OR REPLACE FUNCTION public.patient_matches_segment(
  p_birthdate DATE,
  p_curso_vida TEXT,
  p_program TEXT,
  p_sex TEXT,
  p_city TEXT,
  s public.segments
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    (
      CASE
        WHEN NULLIF(trim(coalesce(s.curso_vida, '')), '') IS NOT NULL
             AND lower(trim(s.curso_vida)) NOT IN ('todos', 'cualquiera') THEN
          COALESCE(p_curso_vida, '') <> '' AND (
            (lower(trim(s.curso_vida)) = 'materno_perinatal' AND lower(p_curso_vida) IN ('preventivo_mujer', 'materno_perinatal'))
            OR lower(p_curso_vida) = lower(trim(s.curso_vida))
          )
        WHEN s.edad_custom IS NOT NULL AND (s.edad_custom ? 'anos') AND NULLIF(s.edad_custom->>'anos', '') IS NOT NULL THEN
          p_birthdate IS NOT NULL AND DATE_PART('year', AGE(CURRENT_DATE, p_birthdate))::INT <= (s.edad_custom->>'anos')::INT
        WHEN s.edad_min IS NOT NULL OR s.edad_max IS NOT NULL THEN
          p_birthdate IS NOT NULL
          AND (s.edad_min IS NULL OR DATE_PART('year', AGE(CURRENT_DATE, p_birthdate))::INT >= s.edad_min)
          AND (s.edad_max IS NULL OR DATE_PART('year', AGE(CURRENT_DATE, p_birthdate))::INT <= s.edad_max)
        ELSE TRUE
      END
    )
    AND (
      NULLIF(trim(coalesce(s.sexo, '')), '') IS NULL
      OR lower(trim(s.sexo)) = 'todos'
      OR (
        NULLIF(trim(coalesce(p_sex, '')), '') IS NOT NULL AND (
          (lower(trim(s.sexo)) IN ('m', 'masculino', 'hombre', 'male') AND lower(trim(p_sex)) IN ('m', 'masculino', 'hombre', 'male'))
          OR (lower(trim(s.sexo)) IN ('f', 'femenino', 'mujer', 'female') AND lower(trim(p_sex)) IN ('f', 'femenino', 'mujer', 'female'))
        )
      )
    )
    AND (
      NULLIF(trim(coalesce(s.ciudad, '')), '') IS NULL
      OR coalesce(p_city, '') ILIKE trim(s.ciudad)
    )
    AND (
      NULLIF(trim(coalesce(s.programa, '')), '') IS NULL
      OR coalesce(p_program, '') ILIKE '%' || trim(s.programa) || '%'
    );
$$;

CREATE OR REPLACE FUNCTION public.evaluate_all_segments_counts(p_hospital_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_seg public.segments%ROWTYPE;
  v_cnt BIGINT := 0;
  v_res JSONB := '{}'::jsonb;
BEGIN
  FOR v_seg IN
    SELECT * FROM public.segments
    WHERE (p_hospital_id IS NULL OR hospital_id = p_hospital_id)
  LOOP
    SELECT count(*)::BIGINT
    INTO v_cnt
    FROM public.patients p
    WHERE p.hospital_id = v_seg.hospital_id
      AND public.patient_matches_segment(p.birthdate, p.curso_vida, p.program, p.sex, p.city, v_seg);

    v_res := v_res || jsonb_build_object(v_seg.id::text, COALESCE(v_cnt, 0));
  END LOOP;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_all_segments_counts(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_segment_patients_paginated(
  p_segment_id UUID,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_seg public.segments%ROWTYPE;
  v_search TEXT := NULLIF(trim(COALESCE(p_search, '')), '');
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_page_size, 50), 1000));
  v_offset INT := (GREATEST(1, COALESCE(p_page, 1)) - 1) * v_limit;
  v_total BIGINT := 0;
  v_demo JSONB := '{"hombres":0,"mujeres":0,"ninos":0,"ninas":0}'::jsonb;
  v_rows JSONB := '[]'::jsonb;
  v_dt18 DATE := (CURRENT_DATE - INTERVAL '18 years')::date;
BEGIN
  SELECT * INTO v_seg FROM public.segments WHERE id = p_segment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('total_count', 0, 'demografia', v_demo, 'rows', '[]'::jsonb);
  END IF;

  SELECT
    count(*)::BIGINT,
    jsonb_build_object(
      'hombres', count(*) FILTER (WHERE COALESCE(p.sex, 'M') NOT IN ('F','f','Femenino','femenino','Mujer','mujer','Female','female') AND (p.birthdate IS NULL OR p.birthdate <= v_dt18)),
      'mujeres', count(*) FILTER (WHERE p.sex IN ('F','f','Femenino','femenino','Mujer','mujer','Female','female') AND (p.birthdate IS NULL OR p.birthdate <= v_dt18)),
      'ninos', count(*) FILTER (WHERE COALESCE(p.sex, 'M') NOT IN ('F','f','Femenino','femenino','Mujer','mujer','Female','female') AND p.birthdate IS NOT NULL AND p.birthdate > v_dt18),
      'ninas', count(*) FILTER (WHERE p.sex IN ('F','f','Femenino','femenino','Mujer','mujer','Female','female') AND p.birthdate IS NOT NULL AND p.birthdate > v_dt18)
    )
  INTO v_total, v_demo
  FROM public.patients p
  WHERE p.hospital_id = v_seg.hospital_id
    AND public.patient_matches_segment(p.birthdate, p.curso_vida, p.program, p.sex, p.city, v_seg)
    AND (
      v_search IS NULL
      OR p.name ILIKE '%' || v_search || '%'
      OR p.document ILIKE '%' || v_search || '%'
      OR p.phone ILIKE '%' || v_search || '%'
    );

  WITH paged AS (
    SELECT
      p.patient_id, p.hospital_id, p.name, p.document, p.tipo_documento,
      p.phone, p.email, p.birthdate, p.sex, p.city, p.program,
      COALESCE(p.curso_vida, 'adultez') AS curso_vida,
      p.grupo_riesgo, COALESCE(p.grupos_riesgo, '{}'::text[]) AS grupos_riesgo,
      p.doctor_id,
      DATE_PART('year', AGE(CURRENT_DATE, p.birthdate))::INT AS edad
    FROM public.patients p
    WHERE p.hospital_id = v_seg.hospital_id
      AND public.patient_matches_segment(p.birthdate, p.curso_vida, p.program, p.sex, p.city, v_seg)
      AND (
        v_search IS NULL
        OR p.name ILIKE '%' || v_search || '%'
        OR p.document ILIKE '%' || v_search || '%'
        OR p.phone ILIKE '%' || v_search || '%'
      )
    ORDER BY p.patient_id ASC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT COALESCE(jsonb_agg(row_to_json(pg)), '[]'::jsonb)
  INTO v_rows
  FROM paged pg;

  RETURN jsonb_build_object(
    'total_count', v_total,
    'demografia', v_demo,
    'rows', v_rows
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_segment_patients_paginated(UUID, INT, INT, TEXT) TO anon, authenticated;

-- 17. Seguimiento Automático a Inasistentes a Citas:
--     Regla: Falta a cita -> +3 días envío SMS -> Si no responde -> +2 días (+5 desde cita original) envío 2° SMS + E-Mail
CREATE TABLE IF NOT EXISTS public.inasistencia_seguimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL,
  appointment_id UUID NULL REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  fecha_cita_original DATE NOT NULL,
  fecha_sms_1 DATE NOT NULL,
  sms_1_enviado_at TIMESTAMPTZ NULL,
  respondio_sms_1 BOOLEAN NOT NULL DEFAULT FALSE,
  respuesta_sms_1_at TIMESTAMPTZ NULL,
  fecha_seguimiento_2 DATE NOT NULL,
  sms_2_enviado_at TIMESTAMPTZ NULL,
  email_2_enviado_at TIMESTAMPTZ NULL,
  estado VARCHAR(40) NOT NULL DEFAULT 'pendiente_sms_3d',
  motivo_cita TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inasistencia_hosp_estado ON public.inasistencia_seguimientos(hospital_id, estado, fecha_sms_1);
CREATE INDEX IF NOT EXISTS idx_inasistencia_patient ON public.inasistencia_seguimientos(patient_id, fecha_cita_original DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inasistencia_appt_unique ON public.inasistencia_seguimientos(appointment_id) WHERE appointment_id IS NOT NULL;

-- Habilitar estado 'inasistente' en public.appointments
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_chk;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_chk
  CHECK (status = ANY (ARRAY['pendiente'::text, 'confirmada'::text, 'cancelada'::text, 'inasistente'::text]));

CREATE OR REPLACE FUNCTION public.register_appointment_noshow(
  p_hospital_id UUID,
  p_patient_id UUID,
  p_fecha_cita_original DATE,
  p_appointment_id UUID DEFAULT NULL,
  p_motivo_cita TEXT DEFAULT NULL,
  p_notas TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hosp UUID := p_hospital_id;
  v_row public.inasistencia_seguimientos%ROWTYPE;
BEGIN
  IF v_hosp IS NULL THEN
    SELECT hospital_id INTO v_hosp FROM public.patients WHERE patient_id = p_patient_id;
  END IF;

  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.inasistencia_seguimientos WHERE appointment_id = p_appointment_id LIMIT 1;
    IF FOUND THEN
      RETURN row_to_json(v_row)::jsonb;
    END IF;
  END IF;

  INSERT INTO public.inasistencia_seguimientos (
    hospital_id,
    appointment_id,
    patient_id,
    fecha_cita_original,
    fecha_sms_1,
    fecha_seguimiento_2,
    estado,
    motivo_cita,
    notas
  ) VALUES (
    v_hosp,
    p_appointment_id,
    p_patient_id,
    p_fecha_cita_original,
    (p_fecha_cita_original + INTERVAL '3 days')::date,
    (p_fecha_cita_original + INTERVAL '5 days')::date,
    'pendiente_sms_3d',
    COALESCE(NULLIF(trim(p_motivo_cita), ''), 'Cita programada Resolución 3280'),
    p_notas
  )
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_appointment_noshow(UUID, UUID, DATE, UUID, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_noshow_followups(
  p_hospital_id UUID DEFAULT NULL,
  p_estado TEXT DEFAULT 'todos',
  p_limit INT DEFAULT 100
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH rows_q AS (
    SELECT
      s.id,
      s.hospital_id,
      s.appointment_id,
      s.patient_id,
      s.fecha_cita_original,
      s.fecha_sms_1,
      s.sms_1_enviado_at,
      s.respondio_sms_1,
      s.respuesta_sms_1_at,
      s.fecha_seguimiento_2,
      s.sms_2_enviado_at,
      s.email_2_enviado_at,
      s.estado,
      s.motivo_cita,
      s.notas,
      s.created_at,
      p.name AS patient_name,
      p.document AS patient_document,
      COALESCE(p.tipo_documento, 'CC') AS patient_tipo_documento,
      p.phone AS patient_phone,
      p.email AS patient_email,
      COALESCE(p.curso_vida, 'adultez') AS patient_curso_vida,
      p.grupo_riesgo AS patient_grupo_riesgo,
      COALESCE(p.grupos_riesgo, '{}'::text[]) AS patient_grupos_riesgo
    FROM public.inasistencia_seguimientos s
    JOIN public.patients p ON p.patient_id = s.patient_id
    WHERE (p_hospital_id IS NULL OR s.hospital_id = p_hospital_id)
      AND (p_estado IS NULL OR p_estado = 'todos' OR s.estado = p_estado)
    ORDER BY s.fecha_cita_original DESC, s.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
  )
  SELECT COALESCE(jsonb_agg(row_to_json(rows_q)), '[]'::jsonb) FROM rows_q;
$$;

GRANT EXECUTE ON FUNCTION public.get_noshow_followups(UUID, TEXT, INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_noshow_followup_step(
  p_id UUID,
  p_action TEXT,
  p_notas TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.inasistencia_seguimientos%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.inasistencia_seguimientos WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de inasistencia no encontrado';
  END IF;

  IF p_action = 'send_sms_1' THEN
    UPDATE public.inasistencia_seguimientos
    SET sms_1_enviado_at = COALESCE(sms_1_enviado_at, NOW()),
        estado = CASE WHEN respondio_sms_1 THEN 'respondio_reagendado' ELSE 'sms_3d_enviado' END,
        notas = COALESCE(NULLIF(trim(p_notas), ''), notas),
        updated_at = NOW()
    WHERE id = p_id
    RETURNING * INTO v_row;

  ELSIF p_action = 'mark_responded' THEN
    UPDATE public.inasistencia_seguimientos
    SET respondio_sms_1 = TRUE,
        respuesta_sms_1_at = NOW(),
        estado = 'respondio_reagendado',
        notas = COALESCE(NULLIF(trim(p_notas), ''), notas),
        updated_at = NOW()
    WHERE id = p_id
    RETURNING * INTO v_row;

  ELSIF p_action = 'send_insistencia_2' THEN
    IF v_row.respondio_sms_1 THEN
      RAISE EXCEPTION 'El paciente ya respondió al primer SMS; no se requiere insistencia.';
    END IF;
    UPDATE public.inasistencia_seguimientos
    SET sms_1_enviado_at = COALESCE(sms_1_enviado_at, NOW()),
        sms_2_enviado_at = NOW(),
        email_2_enviado_at = NOW(),
        estado = 'insistencia_enviada',
        notas = COALESCE(NULLIF(trim(p_notas), ''), notas),
        updated_at = NOW()
    WHERE id = p_id
    RETURNING * INTO v_row;

  ELSE
    RAISE EXCEPTION 'Acción inválida: %', p_action;
  END IF;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_noshow_followup_step(UUID, TEXT, TEXT) TO anon, authenticated;

-- 17b. Actualizar RPCs de citas médicas para exponer Curso de Vida + Grupos de Riesgo y soportar 'inasistente'
DROP FUNCTION IF EXISTS public.get_doctor_appointments_month(UUID, DATE);
CREATE OR REPLACE FUNCTION public.get_doctor_appointments_month(p_doctor_id UUID, p_month_start DATE)
RETURNS TABLE(
  id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT,
  patient_id UUID,
  patient_name TEXT,
  patient_document VARCHAR,
  patient_curso_vida VARCHAR,
  patient_grupo_riesgo VARCHAR,
  patient_grupos_riesgo TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  start_ts TIMESTAMPTZ;
  end_ts TIMESTAMPTZ;
BEGIN
  start_ts := date_trunc('month', p_month_start::timestamptz);
  end_ts := (start_ts + interval '1 month');

  RETURN QUERY
  SELECT
    a.id,
    a.start_at,
    a.end_at,
    a.status,
    a.patient_id,
    p.name AS patient_name,
    p.document AS patient_document,
    COALESCE(p.curso_vida, 'adultez'::varchar) AS patient_curso_vida,
    p.grupo_riesgo AS patient_grupo_riesgo,
    COALESCE(p.grupos_riesgo, '{}'::text[]) AS patient_grupos_riesgo
  FROM public.appointments a
  JOIN public.patients p ON p.patient_id = a.patient_id
  WHERE a.doctor_id = p_doctor_id
    AND a.start_at >= start_ts
    AND a.start_at < end_ts
  ORDER BY a.start_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_appointments_month(UUID, DATE) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_appointment_status_for_doctor(
  p_doctor_id UUID,
  p_appointment_id UUID,
  p_new_status TEXT
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.appointments;
BEGIN
  SELECT * INTO v_row
  FROM public.appointments
  WHERE id = p_appointment_id
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Cita no encontrada';
  END IF;

  IF v_row.doctor_id IS DISTINCT FROM p_doctor_id THEN
    RAISE EXCEPTION 'No autorizado para gestionar esta cita';
  END IF;

  IF p_new_status NOT IN ('pendiente', 'confirmada', 'cancelada', 'inasistente') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;

  UPDATE public.appointments
  SET status = p_new_status, updated_at = now()
  WHERE id = p_appointment_id
  RETURNING * INTO v_row;

  -- Si se marca como inasistente, registrar automáticamente seguimiento (+3d SMS -> +2d SMS + E-Mail)
  IF p_new_status = 'inasistente' THEN
    PERFORM public.register_appointment_noshow(
      v_row.hospital_id,
      v_row.patient_id,
      (v_row.start_at AT TIME ZONE 'America/Bogota')::date,
      v_row.id,
      COALESCE(v_row.notes, 'Cita médica programada'),
      'Generado automáticamente al marcar inasistencia en agenda médica'
    );
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_appointment_status_for_doctor(UUID, UUID, TEXT) TO anon, authenticated;

-- 22. Cupo diario en vivo de 500 llamadas exitosas + registro idempotente del ciclo de vida de llamadas (Puerto 1)
CREATE OR REPLACE FUNCTION public.get_daily_call_quota_status(
  p_hospital_id UUID DEFAULT NULL,
  p_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE := COALESCE(p_date, (NOW() AT TIME ZONE 'America/Bogota')::date);
  v_daily_cap INT := 500;
  v_used_vapi INT := 0;
  v_used_evidence INT := 0;
  v_used_total INT := 0;
BEGIN
  SELECT count(*)::INT
  INTO v_used_vapi
  FROM public.vapi_agent_sessions v
  WHERE (p_hospital_id IS NULL OR v.hospital_id = p_hospital_id)
    AND (v.created_at AT TIME ZONE 'America/Bogota')::date = v_date
    AND NOT COALESCE(v.deteccion_buzon, FALSE)
    AND lower(COALESCE(v.estado_llamada, '')) IN ('completada', 'completed', 'exitosa', 'answered');

  SELECT count(*)::INT
  INTO v_used_evidence
  FROM public.ai_contact_evidence e
  JOIN public.patients p ON p.patient_id = e.patient_id
  WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
    AND (e.created_at AT TIME ZONE 'America/Bogota')::date = v_date
    AND lower(COALESCE(e.canal, '')) ~ '(call|llamada|voz|vapi|tel)'
    AND NOT COALESCE(e.deteccion_buzon, FALSE)
    AND lower(COALESCE(e.resultado_contacto, '')) IN ('contactado_exitoso', 'exitoso', 'completado', 'confirmada', 'entregado')
    AND NOT EXISTS (
      SELECT 1
      FROM public.vapi_agent_sessions v
      WHERE v.patient_id = e.patient_id
        AND abs(EXTRACT(EPOCH FROM (v.created_at - e.created_at))) < 120
    );

  v_used_total := COALESCE(v_used_vapi, 0) + COALESCE(v_used_evidence, 0);

  RETURN jsonb_build_object(
    'date', to_char(v_date, 'YYYY-MM-DD'),
    'daily_cap', v_daily_cap,
    'used_today', v_used_total,
    'remaining_today', GREATEST(0, v_daily_cap - v_used_total)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_call_quota_status(UUID, DATE) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_call_lifecycle_outcome(
  p_hospital_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_doctor_id UUID DEFAULT NULL,
  p_vapi_call_id TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_motivo TEXT DEFAULT 'Demanda Inducida Res. 3280',
  p_duracion_segundos INT DEFAULT 0,
  p_outcome TEXT DEFAULT 'failed',
  p_ended_reason TEXT DEFAULT NULL,
  p_transcript TEXT DEFAULT NULL,
  p_summary TEXT DEFAULT NULL,
  p_slot_tanda TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_call_id TEXT := NULLIF(trim(COALESCE(p_vapi_call_id, '')), '');
  v_is_success BOOLEAN := lower(COALESCE(p_outcome, '')) IN ('success', 'completada', 'exitosa', 'answered');
  v_is_voicemail BOOLEAN := lower(COALESCE(p_ended_reason, '')) ~ '(voicemail|machine_|sip-183|ring-timeout)';
  v_existing_id UUID := NULL;
  v_existing_estado TEXT := NULL;
  v_was_already_success BOOLEAN := FALSE;
  v_dur INT := CASE WHEN v_is_success THEN GREATEST(1, COALESCE(p_duracion_segundos, 1)) ELSE 0 END;
  v_estado TEXT := CASE
    WHEN v_is_success THEN 'completada'
    WHEN v_is_voicemail THEN 'buzon_cortado'
    ELSE 'no_contesta'
  END;
  v_hosp UUID := p_hospital_id;
  v_quota JSONB;
BEGIN
  IF v_hosp IS NULL AND p_patient_id IS NOT NULL THEN
    SELECT p.hospital_id INTO v_hosp FROM public.patients p WHERE p.patient_id = p_patient_id LIMIT 1;
  END IF;

  IF v_call_id IS NULL THEN
    v_call_id := 'sadi-live-' || replace(gen_random_uuid()::text, '-', '');
  END IF;

  SELECT v.id, v.estado_llamada
  INTO v_existing_id, v_existing_estado
  FROM public.vapi_agent_sessions v
  WHERE v.vapi_call_id = v_call_id
  LIMIT 1;

  v_was_already_success := lower(COALESCE(v_existing_estado, '')) IN ('completada', 'completed', 'exitosa', 'answered');

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.vapi_agent_sessions
    SET estado_llamada = CASE WHEN v_was_already_success THEN estado_llamada ELSE v_estado END,
        duracion_segundos = CASE WHEN v_was_already_success THEN GREATEST(duracion_segundos, v_dur) ELSE v_dur END,
        deteccion_buzon = CASE WHEN v_was_already_success THEN FALSE ELSE v_is_voicemail END,
        capa_deteccion = CASE WHEN v_is_success OR v_was_already_success THEN 'dtmf_human' WHEN v_is_voicemail THEN 'vapi_amd_post_answer' ELSE 'no_answer' END,
        motivo_corte = COALESCE(NULLIF(p_ended_reason, ''), motivo_corte, v_estado),
        transcripcion_completa = COALESCE(NULLIF(p_transcript, ''), transcripcion_completa),
        resumen_ia = COALESCE(NULLIF(p_summary, ''), resumen_ia),
        facturable_ips = (v_is_success OR v_was_already_success),
        costo_sadi_cop = CASE WHEN v_is_success OR v_was_already_success THEN GREATEST(duracion_segundos, v_dur) * 12 ELSE 0 END,
        updated_at = NOW()
    WHERE id = v_existing_id;
  ELSIF p_patient_id IS NOT NULL THEN
    INSERT INTO public.vapi_agent_sessions (
      vapi_call_id, patient_id, doctor_id, hospital_id, telefono_llamado,
      motivo_llamada, estado_llamada, duracion_segundos,
      transcripcion_completa, resumen_ia, deteccion_buzon, capa_deteccion,
      cobro_carrier_evitado, sip_codigo_respuesta, motivo_corte,
      facturable_ips, costo_sadi_cop, slot_tanda
    )
    VALUES (
      v_call_id, p_patient_id, p_doctor_id, v_hosp, COALESCE(NULLIF(p_phone, ''), 'desconocido'),
      COALESCE(NULLIF(p_motivo, ''), 'Demanda Inducida Res. 3280'), v_estado, v_dur,
      NULLIF(p_transcript, ''), NULLIF(p_summary, ''), v_is_voicemail,
      CASE WHEN v_is_success THEN 'dtmf_human' WHEN v_is_voicemail THEN 'vapi_amd_post_answer' ELSE 'no_answer' END,
      FALSE, CASE WHEN v_is_success THEN 200 ELSE 480 END, COALESCE(NULLIF(p_ended_reason, ''), v_estado),
      v_is_success, CASE WHEN v_is_success THEN v_dur * 12 ELSE 0 END, p_slot_tanda
    );
  END IF;

  IF v_is_success AND NOT v_was_already_success AND p_patient_id IS NOT NULL THEN
    UPDATE public.patients
    SET conteo_canales = jsonb_set(
      COALESCE(conteo_canales, '{"sms":0,"call":0,"email":0,"whatsapp":0}'::jsonb),
      '{call}',
      to_jsonb(COALESCE((conteo_canales->>'call')::INT, 0) + 1),
      TRUE
    )
    WHERE patient_id = p_patient_id;

    DELETE FROM public.cronograma_summary_cache WHERE cache_key LIKE 'reports_%';
  END IF;

  v_quota := public.get_daily_call_quota_status(v_hosp, (NOW() AT TIME ZONE 'America/Bogota')::date);

  RETURN jsonb_build_object(
    'ok', TRUE,
    'vapi_call_id', v_call_id,
    'counted_as_success', (v_is_success AND NOT v_was_already_success),
    'quota', v_quota
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_call_lifecycle_outcome(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
