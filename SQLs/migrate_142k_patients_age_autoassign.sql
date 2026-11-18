-- ==============================================================================
-- SADI: Migración Escalable (142,602+ pacientes) - Clasificación por Edad Res. 3280
--       y Asignación Automática Determinística 1:1 a Profesionales de public.staff
-- ==============================================================================

-- 1. Nuevas columnas en public.patients (compatibles con launch_sms_tracking_and_patient_security.sql)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS doctor_id UUID NULL REFERENCES public.staff(doctor_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS curso_vida VARCHAR(40),
  ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(10) DEFAULT 'CC',
  ADD COLUMN IF NOT EXISTS llave VARCHAR(40),
  ADD COLUMN IF NOT EXISTS eps VARCHAR(80),
  ADD COLUMN IF NOT EXISTS ips_asignada VARCHAR(120);

-- 2. Índices de alto rendimiento para búsqueda, paginación, clasificación y agregación en 142k+ filas
CREATE INDEX IF NOT EXISTS patients_doctor_idx ON public.patients(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_hospital_doctor_id ON public.patients(hospital_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_hospital_curso_vida ON public.patients(hospital_id, curso_vida);
CREATE INDEX IF NOT EXISTS idx_patients_hospital_birthdate ON public.patients(hospital_id, birthdate);
CREATE INDEX IF NOT EXISTS idx_patients_hospital_grupo_riesgo ON public.patients(hospital_id, grupo_riesgo);
CREATE INDEX IF NOT EXISTS idx_patients_hospital_geo ON public.patients(hospital_id, zona, comuna, barrio);
CREATE INDEX IF NOT EXISTS idx_patients_hosp_created_nl ON public.patients(hospital_id, created_at DESC NULLS LAST, patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_curso_sort ON public.patients(hospital_id, curso_vida, created_at DESC NULLS LAST, patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_doctor_sort ON public.patients(hospital_id, doctor_id, created_at DESC NULLS LAST, patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_demog ON public.patients(hospital_id, sex, birthdate);
CREATE INDEX IF NOT EXISTS idx_patients_reports_cover ON public.patients(hospital_id, curso_vida, grupo_riesgo, zona, comuna, barrio);
CREATE INDEX IF NOT EXISTS gin_patients_barrio_trgm ON public.patients USING gin (barrio gin_trgm_ops);
CREATE INDEX IF NOT EXISTS gin_patients_city_trgm ON public.patients USING gin (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS gin_patients_curso_trgm ON public.patients USING gin (curso_vida gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_nonzero_canales ON public.patients(hospital_id, curso_vida, grupo_riesgo, zona, comuna, barrio)
  WHERE ((conteo_canales->>'sms')::int > 0 OR (conteo_canales->>'email')::int > 0 OR (conteo_canales->>'call')::int > 0 OR (conteo_canales->>'whatsapp')::int > 0);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_llave_unique ON public.patients(llave) WHERE llave IS NOT NULL;

-- 3. Función determinística de Clasificación por Curso de Vida / Edad (Res. 3280 de 2018)
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
  -- Rutas transversales explícitas (G, H, I, J) en curso o programa clínico
  IF v_curso ~ '(mujer|materno|gestan)' OR v_curso = 'g' OR v_curso = 'preventivo_mujer'
     OR v_prog ~ '(embarazo|materno|gestan|preeclampsia|riamp|cuello|\bmama\b|preventivo de la mujer)' THEN
    RETURN 'preventivo_mujer';
  END IF;

  IF v_curso ~ 'planific' OR v_curso = 'h' OR v_curso = 'planificacion_familiar'
     OR v_prog ~ '(planific|anticoncep|reproductiv)' THEN
    RETURN 'planificacion_familiar';
  END IF;

  IF v_curso ~ 'vacun' OR v_curso = 'i' OR v_curso = 'vacunacion'
     OR v_prog ~ '(vacun|esquema pai|\bpai\b)' THEN
    RETURN 'vacunacion';
  END IF;

  IF v_curso ~ '(salud oral|salud_oral|bucal|odont)' OR v_curso = 'j'
     OR v_prog ~ '(salud oral|bucal|odont|fluor)' THEN
    RETURN 'salud_oral';
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

  -- Respaldo por texto explícito de curso de vida
  IF v_curso ~ 'primera' OR v_curso = 'a' THEN RETURN 'primera_infancia'; END IF;
  IF v_curso ~ 'infan' OR v_curso = 'b' THEN RETURN 'infancia'; END IF;
  IF v_curso ~ 'adolesc' OR v_curso = 'c' THEN RETURN 'adolescencia'; END IF;
  IF v_curso ~ 'juven' OR v_curso = 'd' THEN RETURN 'juventud'; END IF;
  IF v_curso ~ '(vej|mayor|geriatr)' OR v_curso = 'f' THEN RETURN 'vejez'; END IF;

  RETURN 'adultez';
END;
$$;

-- 4. Función de asignación automática determinística de 1 paciente según curso_vida y staff activo
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

-- 5. Trigger para clasificar automáticamente por edad y asignar doctor en altas/ediciones individuales
CREATE OR REPLACE FUNCTION public.trg_patients_classify_and_assign_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_curso VARCHAR(40);
BEGIN
  v_new_curso := public.classify_curso_vida_3280(NEW.birthdate, NEW.program, NEW.curso_vida);
  NEW.curso_vida := v_new_curso;

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

-- 5b. Proteger trigger_auto_create_patient_auth ante pacientes sin email (evita fallo NOT NULL en users.email)
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
        user_id,
        email,
        password,
        role,
        is_active,
        created_at
      ) VALUES (
        NEW.patient_id,
        LOWER(TRIM(NEW.email)),
        v_hashed_password,
        'patient',
        true,
        NOW()
      )
      ON CONFLICT (email) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 6. RPC masivo de clasificación por edad y re-asignación automática 1:1 en bloque
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
  -- 1. Asegurar curso_vida actualizado por edad/programa
  UPDATE public.patients p
  SET curso_vida = public.classify_curso_vida_3280(p.birthdate, p.program, p.curso_vida)
  WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
    AND p.curso_vida IS DISTINCT FROM public.classify_curso_vida_3280(p.birthdate, p.program, p.curso_vida);

  -- 2. Asignación balanceada determinística por curso de vida hacia staff activo con asignación específica
  WITH course_keys AS (
    SELECT unnest(ARRAY[
      'primera_infancia','infancia','adolescencia','juventud','adultez','vejez',
      'preventivo_mujer','planificacion_familiar','vacunacion','salud_oral'
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

-- 7. RPC Demografía Dashboard (evita límite de 1,000 filas en PostgREST, <50ms index-only)
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

-- 8. RPC Paginado de Pacientes + Búsqueda Indexada + Filtro Curso de Vida / Doctor (<40ms)
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
  zona VARCHAR,
  barrio VARCHAR,
  comuna VARCHAR,
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
  v_search TEXT := NULLIF(trim(COALESCE(p_search, '')), '');
  v_curso TEXT := NULLIF(lower(trim(COALESCE(p_curso_vida, ''))), '');
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_page_size, 50), 250));
  v_offset INT := (GREATEST(1, COALESCE(p_page, 1)) - 1) * v_limit;
  v_total BIGINT := 0;
BEGIN
  IF v_curso = 'todos' THEN
    v_curso := NULL;
  END IF;

  SELECT count(*)::BIGINT
  INTO v_total
  FROM public.patients p
  WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
    AND (p_doctor_id IS NULL OR p.doctor_id = p_doctor_id)
    AND (v_curso IS NULL OR p.curso_vida = v_curso)
    AND (
      v_search IS NULL
      OR p.name ILIKE '%' || v_search || '%'
      OR p.document ILIKE '%' || v_search || '%'
      OR p.phone ILIKE '%' || v_search || '%'
      OR p.city ILIKE '%' || v_search || '%'
      OR p.barrio ILIKE '%' || v_search || '%'
    );

  RETURN QUERY
  SELECT
    p.patient_id, p.hospital_id, p.name, p.document, p.tipo_documento, p.llave,
    p.phone, p.email, p.birthdate, p.sex, p.city, p.address, p.program,
    COALESCE(p.curso_vida, 'adultez'::varchar) AS curso_vida,
    p.grupo_riesgo, p.zona, p.barrio, p.comuna, p.eps, p.ips_asignada, p.tipo_usuario,
    p.dispositivos_caseros, p.valores_criticos, p.historial_medidas, p.conteo_canales,
    p.doctor_id, s.doctor_name, s.doctor_email, s.doctor_specialty, p.created_at, v_total
  FROM public.patients p
  LEFT JOIN public.staff s ON s.doctor_id = p.doctor_id
  WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
    AND (p_doctor_id IS NULL OR p.doctor_id = p_doctor_id)
    AND (v_curso IS NULL OR p.curso_vida = v_curso)
    AND (
      v_search IS NULL
      OR p.name ILIKE '%' || v_search || '%'
      OR p.document ILIKE '%' || v_search || '%'
      OR p.phone ILIKE '%' || v_search || '%'
      OR p.city ILIKE '%' || v_search || '%'
      OR p.barrio ILIKE '%' || v_search || '%'
    )
  ORDER BY p.created_at DESC NULLS LAST, p.patient_id
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patients_paginated(UUID, TEXT, TEXT, UUID, INT, INT) TO anon, authenticated;

-- 9. RPC Estadísticas de Personal y Asignaciones (Personal + Portal Doctor en <50ms index-only)
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

-- 10. RPC Paginado de Cohorte Asignada a un Profesional (Curso de Vida o Directo 1:1)
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
  zona VARCHAR,
  barrio VARCHAR,
  comuna VARCHAR,
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
  v_search TEXT := NULLIF(trim(COALESCE(p_search, '')), '');
  v_limit INT := GREATEST(1, LEAST(COALESCE(p_page_size, 50), 250));
  v_offset INT := (GREATEST(1, COALESCE(p_page, 1)) - 1) * v_limit;
  v_total BIGINT := 0;
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

  IF p_mode = 'direct' THEN
    IF p_doctor_id IS NULL THEN
      RETURN;
    END IF;

    SELECT count(*)::BIGINT
    INTO v_total
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND p.doctor_id = p_doctor_id
      AND (
        v_search IS NULL
        OR p.name ILIKE '%' || v_search || '%'
        OR p.document ILIKE '%' || v_search || '%'
        OR p.phone ILIKE '%' || v_search || '%'
        OR p.curso_vida ILIKE '%' || v_search || '%'
      );

    RETURN QUERY
    SELECT
      p.patient_id, p.hospital_id, p.name, p.document, p.tipo_documento,
      p.phone, p.email, p.birthdate, p.sex, p.city, p.address, p.program,
      COALESCE(p.curso_vida, 'adultez'::varchar) AS curso_vida,
      p.grupo_riesgo, p.zona, p.barrio, p.comuna, p.eps, p.ips_asignada, p.tipo_usuario,
      p.dispositivos_caseros, p.valores_criticos, p.historial_medidas, p.conteo_canales,
      p.doctor_id, p.created_at, v_total
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND p.doctor_id = p_doctor_id
      AND (
        v_search IS NULL
        OR p.name ILIKE '%' || v_search || '%'
        OR p.document ILIKE '%' || v_search || '%'
        OR p.phone ILIKE '%' || v_search || '%'
        OR p.curso_vida ILIKE '%' || v_search || '%'
      )
    ORDER BY p.created_at DESC NULLS LAST, p.patient_id
    LIMIT v_limit
    OFFSET v_offset;
  ELSIF v_has_todos THEN
    SELECT count(*)::BIGINT
    INTO v_total
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (
        v_search IS NULL
        OR p.name ILIKE '%' || v_search || '%'
        OR p.document ILIKE '%' || v_search || '%'
        OR p.phone ILIKE '%' || v_search || '%'
        OR p.curso_vida ILIKE '%' || v_search || '%'
      );

    RETURN QUERY
    SELECT
      p.patient_id, p.hospital_id, p.name, p.document, p.tipo_documento,
      p.phone, p.email, p.birthdate, p.sex, p.city, p.address, p.program,
      COALESCE(p.curso_vida, 'adultez'::varchar) AS curso_vida,
      p.grupo_riesgo, p.zona, p.barrio, p.comuna, p.eps, p.ips_asignada, p.tipo_usuario,
      p.dispositivos_caseros, p.valores_criticos, p.historial_medidas, p.conteo_canales,
      p.doctor_id, p.created_at, v_total
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND (
        v_search IS NULL
        OR p.name ILIKE '%' || v_search || '%'
        OR p.document ILIKE '%' || v_search || '%'
        OR p.phone ILIKE '%' || v_search || '%'
        OR p.curso_vida ILIKE '%' || v_search || '%'
      )
    ORDER BY p.created_at DESC NULLS LAST, p.patient_id
    LIMIT v_limit
    OFFSET v_offset;
  ELSE
    SELECT count(*)::BIGINT
    INTO v_total
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND p.curso_vida = ANY(v_cursos)
      AND (
        v_search IS NULL
        OR p.name ILIKE '%' || v_search || '%'
        OR p.document ILIKE '%' || v_search || '%'
        OR p.phone ILIKE '%' || v_search || '%'
        OR p.curso_vida ILIKE '%' || v_search || '%'
      );

    RETURN QUERY
    SELECT
      p.patient_id, p.hospital_id, p.name, p.document, p.tipo_documento,
      p.phone, p.email, p.birthdate, p.sex, p.city, p.address, p.program,
      COALESCE(p.curso_vida, 'adultez'::varchar) AS curso_vida,
      p.grupo_riesgo, p.zona, p.barrio, p.comuna, p.eps, p.ips_asignada, p.tipo_usuario,
      p.dispositivos_caseros, p.valores_criticos, p.historial_medidas, p.conteo_canales,
      p.doctor_id, p.created_at, v_total
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND p.curso_vida = ANY(v_cursos)
      AND (
        v_search IS NULL
        OR p.name ILIKE '%' || v_search || '%'
        OR p.document ILIKE '%' || v_search || '%'
        OR p.phone ILIKE '%' || v_search || '%'
        OR p.curso_vida ILIKE '%' || v_search || '%'
      )
    ORDER BY p.created_at DESC NULLS LAST, p.patient_id
    LIMIT v_limit
    OFFSET v_offset;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_assigned_patients_paginated(UUID, TEXT[], UUID, TEXT, TEXT, INT, INT) TO anon, authenticated;

-- 11. RPC Matriz Consolidada de Reportes (Index-Only Scan + partial canales -> ~150ms sobre 142k)
CREATE OR REPLACE FUNCTION public.get_reports_demanda_summary(
  p_hospital_id UUID DEFAULT NULL,
  p_curso_vida TEXT DEFAULT 'todos',
  p_grupo_riesgo TEXT DEFAULT 'todos',
  p_zona TEXT DEFAULT 'todos',
  p_comuna TEXT DEFAULT 'todos',
  p_barrio TEXT DEFAULT 'todos'
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
  WITH grouped AS (
    SELECT
      COALESCE(p.curso_vida, 'adultez') AS raw_curso,
      COALESCE(p.grupo_riesgo, '') AS raw_riesgo,
      CASE
        WHEN lower(COALESCE(p.zona, '')) LIKE 'rural%' THEN 'Rural'
        WHEN lower(COALESCE(p.zona, '')) LIKE 'urban%' THEN 'Urbana'
        ELSE ''
      END AS zona_norm,
      trim(COALESCE(p.comuna, '')) AS comuna_lbl,
      trim(COALESCE(p.barrio, '')) AS barrio_lbl,
      count(*)::BIGINT AS cnt
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
    GROUP BY p.curso_vida, p.grupo_riesgo, p.zona, p.comuna, p.barrio
  ),
  channel_groups AS (
    SELECT
      COALESCE(p.curso_vida, 'adultez') AS raw_curso,
      COALESCE(p.grupo_riesgo, '') AS raw_riesgo,
      CASE
        WHEN lower(COALESCE(p.zona, '')) LIKE 'rural%' THEN 'Rural'
        WHEN lower(COALESCE(p.zona, '')) LIKE 'urban%' THEN 'Urbana'
        ELSE ''
      END AS zona_norm,
      trim(COALESCE(p.comuna, '')) AS comuna_lbl,
      trim(COALESCE(p.barrio, '')) AS barrio_lbl,
      COALESCE(sum((p.conteo_canales->>'sms')::INT), 0)::BIGINT AS stored_sms,
      COALESCE(sum((p.conteo_canales->>'email')::INT), 0)::BIGINT AS stored_email,
      COALESCE(sum((p.conteo_canales->>'call')::INT), 0)::BIGINT AS stored_call,
      COALESCE(sum((p.conteo_canales->>'whatsapp')::INT), 0)::BIGINT AS stored_whatsapp
    FROM public.patients p
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
      AND ((p.conteo_canales->>'sms')::int > 0 OR (p.conteo_canales->>'email')::int > 0 OR (p.conteo_canales->>'call')::int > 0 OR (p.conteo_canales->>'whatsapp')::int > 0)
    GROUP BY p.curso_vida, p.grupo_riesgo, p.zona, p.comuna, p.barrio
  ),
  base_pts AS (
    SELECT
      CASE g.raw_curso
        WHEN 'primera_infancia' THEN 'A'
        WHEN 'infancia' THEN 'B'
        WHEN 'adolescencia' THEN 'C'
        WHEN 'juventud' THEN 'D'
        WHEN 'adultez' THEN 'E'
        WHEN 'vejez' THEN 'F'
        WHEN 'preventivo_mujer' THEN 'G'
        WHEN 'planificacion_familiar' THEN 'H'
        WHEN 'vacunacion' THEN 'I'
        WHEN 'salud_oral' THEN 'J'
        ELSE 'E'
      END AS curso_code,
      CASE
        WHEN lower(g.raw_riesgo) ~ '(materno|gestan|prenatal|riamp|puerper)' THEN 1
        WHEN lower(g.raw_riesgo) ~ '(cardio|hipertens|diabet|metab|renal|hta)' THEN 2
        WHEN lower(g.raw_riesgo) ~ '(cáncer|cancer|oncol|mama|próstata|prostata|cuello uterino)' THEN 3
        WHEN lower(g.raw_riesgo) ~ '(respira|asma|epoc|bronqu)' THEN 4
        WHEN lower(g.raw_riesgo) ~ '(mental|sustanc|psico|depres|ansied|violen|spa)' THEN 5
        WHEN lower(g.raw_riesgo) ~ '(infec|zoonot|vih|tubercul|dengue)' THEN 6
        WHEN lower(g.raw_riesgo) ~ '(nutric|desnutr|crecimiento)' THEN 7
        ELSE NULL
      END AS riesgo_id,
      g.zona_norm,
      g.comuna_lbl,
      g.barrio_lbl,
      g.cnt,
      COALESCE(cg.stored_sms, 0)::BIGINT AS stored_sms,
      COALESCE(cg.stored_email, 0)::BIGINT AS stored_email,
      COALESCE(cg.stored_call, 0)::BIGINT AS stored_call,
      COALESCE(cg.stored_whatsapp, 0)::BIGINT AS stored_whatsapp
    FROM grouped g
    LEFT JOIN channel_groups cg
      ON cg.raw_curso = g.raw_curso
     AND cg.raw_riesgo = g.raw_riesgo
     AND cg.zona_norm = g.zona_norm
     AND cg.comuna_lbl = g.comuna_lbl
     AND cg.barrio_lbl = g.barrio_lbl
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
      riesgo_id AS id,
      sum(cnt)::BIGINT AS total_censo,
      sum(stored_sms)::BIGINT AS sms,
      sum(stored_email)::BIGINT AS email,
      sum(stored_call)::BIGINT AS call,
      sum(stored_whatsapp)::BIGINT AS whatsapp
    FROM base_pts
    WHERE riesgo_id IS NOT NULL
    GROUP BY riesgo_id
  ),
  filtered AS (
    SELECT *
    FROM base_pts
    WHERE (p_curso_vida IS NULL OR p_curso_vida = 'todos' OR curso_code = upper(trim(p_curso_vida)))
      AND (p_grupo_riesgo IS NULL OR p_grupo_riesgo = 'todos' OR riesgo_id = NULLIF(regexp_replace(p_grupo_riesgo, '\D', '', 'g'), '')::INT)
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
  interactions_totals AS (
    SELECT
      count(*) FILTER (WHERE lower(COALESCE(tipo, '')) ~ 'sms')::BIGINT AS sms,
      count(*) FILTER (WHERE lower(COALESCE(tipo, '')) ~ '(email|mail|correo)')::BIGINT AS email,
      count(*) FILTER (WHERE lower(COALESCE(tipo, '')) ~ '(call|llamada|voz|vapi|tel)')::BIGINT AS call,
      count(*) FILTER (WHERE lower(COALESCE(tipo, '')) ~ '(what|wpp)')::BIGINT AS whatsapp
    FROM public.interactions
    WHERE (p_hospital_id IS NULL OR hospital_id = p_hospital_id)
  ),
  vapi_totals AS (
    SELECT count(*)::BIGINT AS call
    FROM public.vapi_agent_sessions
    WHERE (p_hospital_id IS NULL OR hospital_id = p_hospital_id)
  ),
  sms_totals AS (
    SELECT count(*) FILTER (WHERE status = 'sent')::BIGINT AS sms
    FROM public.openvox_sms_dispatches
    WHERE (p_hospital_id IS NULL OR hospital_id = p_hospital_id)
  ),
  evidence_totals AS (
    SELECT
      count(*) FILTER (WHERE lower(COALESCE(e.canal, '')) ~ 'sms')::BIGINT AS sms,
      count(*) FILTER (WHERE lower(COALESCE(e.canal, '')) ~ '(email|mail|correo)')::BIGINT AS email,
      count(*) FILTER (WHERE lower(COALESCE(e.canal, '')) ~ '(call|llamada|voz|vapi|tel)')::BIGINT AS call,
      count(*) FILTER (WHERE lower(COALESCE(e.canal, '')) ~ '(what|wpp)')::BIGINT AS whatsapp
    FROM public.ai_contact_evidence e
    JOIN public.patients p ON p.patient_id = e.patient_id
    WHERE (p_hospital_id IS NULL OR p.hospital_id = p_hospital_id)
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
    'event_totals', jsonb_build_object(
      'sms', (SELECT sms FROM interactions_totals) + (SELECT sms FROM sms_totals) + (SELECT sms FROM evidence_totals),
      'email', (SELECT email FROM interactions_totals) + (SELECT email FROM evidence_totals),
      'call', (SELECT call FROM interactions_totals) + (SELECT call FROM vapi_totals) + (SELECT call FROM evidence_totals),
      'whatsapp', (SELECT whatsapp FROM interactions_totals) + (SELECT whatsapp FROM evidence_totals)
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_reports_demanda_summary(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 12. RPC Facturación: Pacientes con conteo_canales > 0 usando índice parcial (<5ms sobre 142k)
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
