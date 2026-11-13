-- SwasthyaIQ Arihant prototype — initial schema (DIG-2)
-- Synthetic data only. Signed visits are read-only; corrections go to visit_amendments.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username         text NOT NULL UNIQUE CHECK (username = lower(username)),
  cognito_sub      text UNIQUE,
  display_name     text NOT NULL,
  role             text NOT NULL CHECK (role IN ('doctor', 'admin')),
  specialty        text CHECK (specialty IN ('gastro', 'eye')),
  qualifications   text,
  registration_no  text,            -- made up; printed as "sample — not a real registration number"
  enabled          boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Remote sign-out: any token issued before revoked_at is rejected by the API.
CREATE TABLE session_revocations (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  revoked_at  timestamptz NOT NULL,
  revoked_by  uuid REFERENCES users(id)
);

-- ---------------------------------------------------------------- patients and queue
CREATE TABLE patients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token              text NOT NULL UNIQUE,          -- G1–G6, E1–E6
  full_name          text NOT NULL,
  age_years          integer NOT NULL CHECK (age_years BETWEEN 0 AND 120),
  sex                text NOT NULL CHECK (sex IN ('M', 'F')),
  guardian_name      text,
  phone              text,
  primary_doctor_id  uuid NOT NULL REFERENCES users(id),
  allergies          text[] NOT NULL DEFAULT '{}',
  conditions         text[] NOT NULL DEFAULT '{}',
  is_seed            boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patients_name_idx ON patients (lower(full_name));

CREATE TABLE queue_entries (
  patient_id          uuid PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  reason              text NOT NULL,
  status              text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_consult', 'done')),
  in_consult_with     uuid REFERENCES users(id),
  status_changed_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'in_consult') = (in_consult_with IS NOT NULL))
);

-- ---------------------------------------------------------------- visits (versioned)
CREATE TABLE visits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id    uuid NOT NULL REFERENCES users(id),
  visit_date   date NOT NULL,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed')),
  version      integer NOT NULL DEFAULT 1,
  diagnosis    text,
  icd10_code   text,
  follow_up    date,
  is_seed      boolean NOT NULL DEFAULT false,
  signed_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'signed') = (signed_at IS NOT NULL))
);
CREATE INDEX visits_patient_idx ON visits (patient_id, visit_date DESC);

CREATE TABLE visit_amendments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id     uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  version      integer NOT NULL,
  amended_by   uuid NOT NULL REFERENCES users(id),
  reason       text NOT NULL,
  changes      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visit_id, version)
);

-- Consult note, one row per field, with the source badge (dictated / scanned / typed).
CREATE TABLE consult_fields (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id               uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  section                text NOT NULL,
  key                    text NOT NULL,
  value                  text NOT NULL,
  source                 text NOT NULL CHECK (source IN ('dictated', 'scanned', 'typed')),
  confirmed              boolean NOT NULL DEFAULT false,
  confidence             numeric(4, 3),
  original_language      text CHECK (original_language IN ('en', 'mr', 'hi', 'gu')),
  original_transcript    text,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visit_id, section, key)
);

-- ---------------------------------------------------------------- prescriptions
CREATE TABLE prescriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id     uuid NOT NULL UNIQUE REFERENCES visits(id) ON DELETE CASCADE,
  advice       text,
  pdf_s3_key   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rx_lines (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id        uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  position               integer NOT NULL,
  medicine_brand         text NOT NULL,
  medicine_generic       text NOT NULL,
  form                   text NOT NULL,
  eye                    text CHECK (eye IN ('RE', 'LE', 'BE')),
  dose                   text NOT NULL,
  frequency              text NOT NULL,
  timing                 text,
  duration               text NOT NULL,
  taper                  text,
  instructions_en        text,
  instructions_local     text,
  instructions_language  text CHECK (instructions_language IN ('mr', 'hi', 'gu')),
  source                 text NOT NULL DEFAULT 'typed' CHECK (source IN ('dictated', 'scanned', 'typed')),
  UNIQUE (prescription_id, position)
);

-- ---------------------------------------------------------------- attachments and labs
CREATE TABLE attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id     uuid REFERENCES visits(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('photo', 'scan', 'lab_report', 'narrative_report', 'rx_pdf', 'audio')),
  s3_key       text NOT NULL,
  mime_type    text NOT NULL,
  bytes        integer NOT NULL CHECK (bytes > 0),
  summary      text,
  created_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lab_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id       uuid REFERENCES visits(id) ON DELETE CASCADE,
  attachment_id  uuid REFERENCES attachments(id) ON DELETE SET NULL,
  report_date    date NOT NULL,
  lab_name       text,
  confirmed      boolean NOT NULL DEFAULT false,
  is_seed        boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lab_reports_patient_idx ON lab_reports (patient_id, report_date DESC);

CREATE TABLE lab_values (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_report_id   uuid NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
  test_code       text NOT NULL,        -- canonical code, e.g. ALT, HBA1C (unknown tests: 'OTHER')
  test_name       text NOT NULL,        -- as printed on the report
  value_text      text NOT NULL,
  value_num       numeric,
  unit            text,
  ref_range       text,
  flag            text CHECK (flag IN ('H', 'L')),
  confidence      numeric(4, 3)
);
CREATE INDEX lab_values_trend_idx ON lab_values (test_code);

-- ---------------------------------------------------------------- audit and usage
CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  user_id       uuid REFERENCES users(id),
  username      text,
  action        text NOT NULL,          -- e.g. 'queue.reset', 'visit.sign', 'POST /admin/...'
  entity_type   text,
  entity_id     text,
  http_method   text,
  path          text,
  status_code   integer,
  at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_at_idx ON audit_log (at DESC);

CREATE TABLE usage_events (
  id           bigserial PRIMARY KEY,
  user_id      uuid REFERENCES users(id),
  event_type   text NOT NULL,           -- e.g. 'stt.sarvam', 'ocr.textract', 'llm.bedrock'
  units        numeric NOT NULL DEFAULT 0,
  unit_type    text,                    -- 'audio_seconds', 'pages', 'tokens'
  cost_inr     numeric(12, 4),
  meta         jsonb NOT NULL DEFAULT '{}',   -- never patient identifiers
  at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_at_idx ON usage_events (at DESC);

-- ---------------------------------------------------------------- read-only rules for signed visits
-- Signed visits and their children cannot be changed. The only exception is the
-- admin "Clear test visits" action, which sets swasthyaiq.allow_test_clear = 'on'
-- for its own transaction and deletes non-seed visits.

CREATE FUNCTION swasthyaiq_test_clear_allowed() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('swasthyaiq.allow_test_clear', true), '') = 'on'
$$;

CREATE FUNCTION swasthyaiq_guard_signed_visit() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'signed' THEN
    RAISE EXCEPTION 'visit % is signed and read-only; add an amendment instead', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' AND OLD.status = 'signed' AND NOT swasthyaiq_test_clear_allowed() THEN
    RAISE EXCEPTION 'visit % is signed and cannot be deleted', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER visits_signed_guard
  BEFORE UPDATE OR DELETE ON visits
  FOR EACH ROW EXECUTE FUNCTION swasthyaiq_guard_signed_visit();

CREATE FUNCTION swasthyaiq_guard_child_of_signed_visit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_visit_id uuid;
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' AND swasthyaiq_test_clear_allowed() THEN
    RETURN OLD;
  END IF;
  IF TG_TABLE_NAME = 'rx_lines' THEN
    SELECT p.visit_id INTO v_visit_id FROM prescriptions p
      WHERE p.id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.prescription_id ELSE NEW.prescription_id END);
  ELSIF TG_OP = 'DELETE' THEN
    v_visit_id := OLD.visit_id;
  ELSE
    v_visit_id := NEW.visit_id;
  END IF;
  SELECT status INTO v_status FROM visits WHERE id = v_visit_id;
  IF v_status = 'signed' THEN
    RAISE EXCEPTION '% belongs to signed visit % and is read-only', TG_TABLE_NAME, v_visit_id
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER consult_fields_signed_guard
  BEFORE INSERT OR UPDATE OR DELETE ON consult_fields
  FOR EACH ROW EXECUTE FUNCTION swasthyaiq_guard_child_of_signed_visit();

CREATE TRIGGER prescriptions_signed_guard
  BEFORE INSERT OR UPDATE OR DELETE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION swasthyaiq_guard_child_of_signed_visit();

CREATE TRIGGER rx_lines_signed_guard
  BEFORE INSERT OR UPDATE OR DELETE ON rx_lines
  FOR EACH ROW EXECUTE FUNCTION swasthyaiq_guard_child_of_signed_visit();
