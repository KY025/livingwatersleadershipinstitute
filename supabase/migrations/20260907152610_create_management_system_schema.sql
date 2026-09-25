-- Living Waters 611 Leadership Institute Management System

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- SERIES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_type text NOT NULL,
  series_sem int NOT NULL,
  series_name text NOT NULL,
  series_task text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_series" ON public.series;
DROP POLICY IF EXISTS "anon_insert_series" ON public.series;
DROP POLICY IF EXISTS "anon_update_series" ON public.series;
DROP POLICY IF EXISTS "anon_delete_series" ON public.series;

CREATE POLICY "anon_select_series"
ON public.series
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "anon_insert_series"
ON public.series
FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "anon_update_series"
ON public.series
FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "anon_delete_series"
ON public.series
FOR DELETE TO anon, authenticated
USING (true);

-- ============================================================
-- APP SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY,
  current_sem int NOT NULL DEFAULT 1
    CHECK (current_sem IN (1,2,3)),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.app_settings (id, current_sem)
VALUES ('default', 1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "anon_update_app_settings" ON public.app_settings;

CREATE POLICY "anon_select_app_settings"
ON public.app_settings
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "anon_update_app_settings"
ON public.app_settings
FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ============================================================
-- STUDENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  password text,
  series_types text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS auth_user_id uuid;

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS drive_folder_id text;

ALTER TABLE public.students
ALTER COLUMN password DROP NOT NULL;

UPDATE public.students
SET status = 'active'
WHERE status IS NULL;

ALTER TABLE public.students
ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE public.students
ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.students
DROP CONSTRAINT IF EXISTS students_status_check;

ALTER TABLE public.students
ADD CONSTRAINT students_status_check
CHECK (status IN ('active','inactive'));

DROP INDEX IF EXISTS public.idx_students_unique_email;
DROP INDEX IF EXISTS public.idx_students_unique_auth_user;

WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(email)
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.students
  WHERE email IS NOT NULL
)
UPDATE public.students s
SET status = 'inactive'
FROM duplicates d
WHERE s.id = d.id
AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_unique_email
ON public.students (lower(email))
WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_unique_auth_user
ON public.students (auth_user_id)
WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_name
ON public.students(student_name);

CREATE INDEX IF NOT EXISTS idx_students_status
ON public.students(status);

CREATE INDEX IF NOT EXISTS idx_students_email
ON public.students(lower(email));

ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.students
TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.students
TO service_role;

-- ============================================================
-- SERIES TASK RECORDS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.series_task_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL
    REFERENCES public.students(id)
    ON DELETE CASCADE,
  series_id uuid NOT NULL
    REFERENCES public.series(id)
    ON DELETE CASCADE,
  student_done boolean NOT NULL DEFAULT false,
  teacher_confirmed boolean NOT NULL DEFAULT false,
  remarks text,
  drive_files jsonb NOT NULL DEFAULT '[]'::jsonb, 
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, series_id)
);

ALTER TABLE public.series_task_records DROP COLUMN IF EXISTS drive_file_id;
ALTER TABLE public.series_task_records DROP COLUMN IF EXISTS drive_file_name;
ALTER TABLE public.series_task_records DROP COLUMN IF EXISTS drive_file_url;

ALTER TABLE public.series_task_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_series_task_records" ON public.series_task_records;
DROP POLICY IF EXISTS "anon_insert_series_task_records" ON public.series_task_records;
DROP POLICY IF EXISTS "anon_update_series_task_records" ON public.series_task_records;
DROP POLICY IF EXISTS "anon_delete_series_task_records" ON public.series_task_records;

CREATE POLICY "anon_select_series_task_records"
ON public.series_task_records
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "anon_insert_series_task_records"
ON public.series_task_records
FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "anon_update_series_task_records"
ON public.series_task_records
FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "anon_delete_series_task_records"
ON public.series_task_records
FOR DELETE TO anon, authenticated
USING (true);

-- ============================================================
-- SCRIPTURE RECORDS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.scripture_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL
    REFERENCES public.students(id)
    ON DELETE CASCADE,
  scripture_mode text NOT NULL,
  scripture_part text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.scripture_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_scripture_records" ON public.scripture_records;
DROP POLICY IF EXISTS "anon_insert_scripture_records" ON public.scripture_records;
DROP POLICY IF EXISTS "anon_update_scripture_records" ON public.scripture_records;
DROP POLICY IF EXISTS "anon_delete_scripture_records" ON public.scripture_records;

CREATE POLICY "anon_select_scripture_records"
ON public.scripture_records
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "anon_insert_scripture_records"
ON public.scripture_records
FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "anon_update_scripture_records"
ON public.scripture_records
FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "anon_delete_scripture_records"
ON public.scripture_records
FOR DELETE TO anon, authenticated
USING (true);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_series_type_sem
ON public.series(series_type, series_sem);

CREATE INDEX IF NOT EXISTS idx_series_task_records_student
ON public.series_task_records(student_id);

CREATE INDEX IF NOT EXISTS idx_scripture_records_student
ON public.scripture_records(student_id);

-- ============================================================
-- GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.app_settings,
   public.series,
   public.students,
   public.series_task_records,
   public.scripture_records
TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.app_settings,
   public.series,
   public.students,
   public.series_task_records,
   public.scripture_records
TO service_role;

-- ============================================================
-- STUDENT AUTH TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_student_profile_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_name text;
BEGIN

  profile_name := NULLIF(
    trim(
      COALESCE(
        NEW.raw_user_meta_data->>'student_name',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1),
        '学房生'
      )
    ),
    ''
  );

  IF EXISTS (
    SELECT 1
    FROM public.students
    WHERE auth_user_id = NEW.id
  ) THEN

    UPDATE public.students
    SET email = lower(NEW.email)
    WHERE auth_user_id = NEW.id;

  ELSE

    INSERT INTO public.students (
      student_name,
      email,
      auth_user_id,
      series_types,
      status
    )
    VALUES (
      profile_name,
      lower(NEW.email),
      NEW.id,
      '{}',
      'active'
    );

  END IF;

  RETURN NEW;

END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_student_profile
ON auth.users;

CREATE TRIGGER on_auth_user_created_student_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_student_profile_from_auth();