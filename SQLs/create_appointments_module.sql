CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.jwt_role() IN ('super_admin', 'operator', 'hospital_admin')
     OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.hospital_id = auth.uid());
$$;

CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL UNIQUE REFERENCES public.staff(doctor_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.doctor_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL UNIQUE REFERENCES public.staff(doctor_id) ON DELETE CASCADE,
  hospital_id UUID NULL REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Bogota',
  slot_minutes INTEGER NOT NULL DEFAULT 30,
  workdays SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  morning_start TIME NOT NULL DEFAULT TIME '05:00',
  morning_end TIME NOT NULL DEFAULT TIME '11:00',
  afternoon_start TIME NOT NULL DEFAULT TIME '14:00',
  afternoon_end TIME NOT NULL DEFAULT TIME '20:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT doctor_schedules_slot_minutes_chk CHECK (slot_minutes BETWEEN 5 AND 180),
  CONSTRAINT doctor_schedules_workdays_chk CHECK (
    array_length(workdays, 1) IS NOT NULL
    AND workdays <@ ARRAY[1,2,3,4,5,6,7]::SMALLINT[]
  ),
  CONSTRAINT doctor_schedules_morning_chk CHECK (morning_start < morning_end),
  CONSTRAINT doctor_schedules_afternoon_chk CHECK (afternoon_start < afternoon_end),
  CONSTRAINT doctor_schedules_windows_no_overlap_chk CHECK (morning_end <= afternoon_start)
);

CREATE INDEX IF NOT EXISTS doctor_schedules_hospital_idx ON public.doctor_schedules(hospital_id);

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NULL REFERENCES public.hospitals(hospital_id) ON DELETE SET NULL,
  doctor_id UUID NOT NULL REFERENCES public.staff(doctor_id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointments_time_chk CHECK (start_at < end_at),
  CONSTRAINT appointments_status_chk CHECK (status IN ('pendiente', 'confirmada', 'cancelada'))
);

CREATE INDEX IF NOT EXISTS appointments_doctor_start_idx ON public.appointments(doctor_id, start_at);
CREATE INDEX IF NOT EXISTS appointments_patient_start_idx ON public.appointments(patient_id, start_at);
CREATE INDEX IF NOT EXISTS appointments_hospital_start_idx ON public.appointments(hospital_id, start_at);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON public.appointments(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'appointments_no_overlap_per_doctor'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_no_overlap_per_doctor
      EXCLUDE USING gist (
        doctor_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (status <> 'cancelada');
  END IF;
END;
$$;

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage doctors" ON public.doctors;
CREATE POLICY "Admin can manage doctors"
ON public.doctors
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admin can manage doctor schedules" ON public.doctor_schedules;
CREATE POLICY "Admin can manage doctor schedules"
ON public.doctor_schedules
FOR ALL
TO authenticated
USING (public.is_admin_user() AND (hospital_id IS NULL OR hospital_id = auth.uid()))
WITH CHECK (public.is_admin_user() AND (hospital_id IS NULL OR hospital_id = auth.uid()));

DROP POLICY IF EXISTS "Admin can manage appointments" ON public.appointments;
CREATE POLICY "Admin can manage appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (public.is_admin_user() AND (hospital_id IS NULL OR hospital_id = auth.uid()))
WITH CHECK (public.is_admin_user() AND (hospital_id IS NULL OR hospital_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.get_doctor_schedule(p_doctor_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.doctor_schedules;
  result JSON;
BEGIN
  SELECT * INTO s
  FROM public.doctor_schedules
  WHERE doctor_id = p_doctor_id
  LIMIT 1;

  IF s.doctor_id IS NULL THEN
    SELECT json_build_object(
      'doctor_id', p_doctor_id,
      'timezone', 'America/Bogota',
      'slot_minutes', 30,
      'workdays', ARRAY[1,2,3,4,5],
      'morning_start', '05:00',
      'morning_end', '11:00',
      'afternoon_start', '14:00',
      'afternoon_end', '20:00'
    ) INTO result;
    RETURN result;
  END IF;

  SELECT json_build_object(
    'doctor_id', s.doctor_id,
    'hospital_id', s.hospital_id,
    'timezone', s.timezone,
    'slot_minutes', s.slot_minutes,
    'workdays', s.workdays,
    'morning_start', to_char(s.morning_start, 'HH24:MI'),
    'morning_end', to_char(s.morning_end, 'HH24:MI'),
    'afternoon_start', to_char(s.afternoon_start, 'HH24:MI'),
    'afternoon_end', to_char(s.afternoon_end, 'HH24:MI')
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_schedule(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_doctor_booked_slots_month(
  p_doctor_id UUID,
  p_month_start DATE
)
RETURNS TABLE (
  start_at TIMESTAMPTZ,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_ts TIMESTAMPTZ;
  end_ts TIMESTAMPTZ;
BEGIN
  start_ts := date_trunc('month', p_month_start::timestamptz);
  end_ts := (start_ts + interval '1 month');

  RETURN QUERY
  SELECT a.start_at, a.status
  FROM public.appointments a
  WHERE a.doctor_id = p_doctor_id
    AND a.start_at >= start_ts
    AND a.start_at < end_ts
    AND a.status <> 'cancelada'
  ORDER BY a.start_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_booked_slots_month(UUID, DATE) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_doctor_appointments_month(
  p_doctor_id UUID,
  p_month_start DATE
)
RETURNS TABLE (
  id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT,
  patient_id UUID,
  patient_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    p.name AS patient_name
  FROM public.appointments a
  JOIN public.patients p ON p.patient_id = a.patient_id
  WHERE a.doctor_id = p_doctor_id
    AND a.start_at >= start_ts
    AND a.start_at < end_ts
  ORDER BY a.start_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_appointments_month(UUID, DATE) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_patient_appointments_month(
  p_patient_id UUID,
  p_month_start DATE
)
RETURNS TABLE (
  id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT,
  doctor_id UUID,
  doctor_name TEXT,
  doctor_specialty TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    a.doctor_id,
    s.doctor_name,
    s.doctor_specialty
  FROM public.appointments a
  JOIN public.staff s ON s.doctor_id = a.doctor_id
  WHERE a.patient_id = p_patient_id
    AND a.start_at >= start_ts
    AND a.start_at < end_ts
  ORDER BY a.start_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_appointments_month(UUID, DATE) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_appointment_for_patient(
  p_patient_id UUID,
  p_doctor_id UUID,
  p_start_at TIMESTAMPTZ,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s JSON;
  tz TEXT;
  slot_mins INTEGER;
  workdays SMALLINT[];
  morning_start TIME;
  morning_end TIME;
  afternoon_start TIME;
  afternoon_end TIME;
  local_ts TIMESTAMP;
  local_dow SMALLINT;
  local_time TIME;
  local_end_time TIME;
  end_at TIMESTAMPTZ;
  v_patient_hospital UUID;
  v_doctor_hospital UUID;
  v_row public.appointments;
BEGIN
  SELECT hospital_id INTO v_patient_hospital
  FROM public.patients
  WHERE patient_id = p_patient_id
  LIMIT 1;

  IF v_patient_hospital IS NULL THEN
    RAISE EXCEPTION 'Paciente no encontrado';
  END IF;

  SELECT hospital_id INTO v_doctor_hospital
  FROM public.staff
  WHERE doctor_id = p_doctor_id
  LIMIT 1;

  IF v_doctor_hospital IS NULL THEN
    RAISE EXCEPTION 'Doctor no encontrado';
  END IF;

  IF v_patient_hospital IS DISTINCT FROM v_doctor_hospital THEN
    RAISE EXCEPTION 'Paciente y doctor no pertenecen al mismo hospital';
  END IF;

  s := public.get_doctor_schedule(p_doctor_id);
  tz := COALESCE(s ->> 'timezone', 'America/Bogota');
  slot_mins := COALESCE(NULLIF((s ->> 'slot_minutes')::INT, 0), 30);
  workdays := COALESCE(ARRAY(SELECT json_array_elements_text(s -> 'workdays')::SMALLINT), ARRAY[1,2,3,4,5]);
  morning_start := COALESCE((s ->> 'morning_start')::TIME, TIME '05:00');
  morning_end := COALESCE((s ->> 'morning_end')::TIME, TIME '11:00');
  afternoon_start := COALESCE((s ->> 'afternoon_start')::TIME, TIME '14:00');
  afternoon_end := COALESCE((s ->> 'afternoon_end')::TIME, TIME '20:00');

  local_ts := p_start_at AT TIME ZONE tz;
  local_dow := EXTRACT(ISODOW FROM local_ts)::SMALLINT;
  local_time := local_ts::TIME;
  end_at := p_start_at + make_interval(mins => slot_mins);
  local_end_time := (end_at AT TIME ZONE tz)::TIME;

  IF NOT (local_dow = ANY(workdays)) THEN
    RAISE EXCEPTION 'Fuera de días laborales';
  END IF;

  IF NOT (
    (local_time >= morning_start AND local_end_time <= morning_end)
    OR (local_time >= afternoon_start AND local_end_time <= afternoon_end)
  ) THEN
    RAISE EXCEPTION 'Fuera del horario del doctor';
  END IF;

  INSERT INTO public.appointments (
    hospital_id,
    doctor_id,
    patient_id,
    start_at,
    end_at,
    status,
    notes
  ) VALUES (
    v_doctor_hospital,
    p_doctor_id,
    p_patient_id,
    p_start_at,
    end_at,
    'pendiente',
    p_notes
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_appointment_for_patient(UUID, UUID, TIMESTAMPTZ, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_appointment_status_for_doctor(
  p_doctor_id UUID,
  p_appointment_id UUID,
  p_new_status TEXT
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF p_new_status NOT IN ('pendiente', 'confirmada', 'cancelada') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;

  UPDATE public.appointments
  SET status = p_new_status, updated_at = now()
  WHERE id = p_appointment_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_appointment_status_for_doctor(UUID, UUID, TEXT) TO anon, authenticated;
