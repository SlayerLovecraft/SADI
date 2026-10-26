WITH specialty_list AS (
  SELECT ARRAY[
    'cardiologo',
    'obstetra',
    'general',
    'radiologo',
    'neurologico',
    'pediatra',
    'traumatologo',
    'ginecologo',
    'oncologo',
    'dermatologo'
  ] AS specialties
)
INSERT INTO public.staff (
  doctor_name,
  doctor_email,
  doctor_password,
  doctor_specialty,
  hospital_id,
  is_active,
  must_change_password
)
SELECT
  NULL AS doctor_name,
  'doctor' || gs.n::text || '@sadi.com.co' AS doctor_email,
  'passwordstaff' || lpad(gs.n::text, 2, '0') AS doctor_password,
  (SELECT specialties[((gs.n - 1) / 100) + 1] FROM specialty_list) AS doctor_specialty,
  NULL::uuid AS hospital_id,
  TRUE AS is_active,
  FALSE AS must_change_password
FROM generate_series(101, 1000) AS gs(n)
ON CONFLICT (doctor_email) DO NOTHING;

