-- DIG-41: draft save, sign and amendment for visits.

-- One row per diagnosis on a visit: an ICD-10 code, or "Misc" free text. Position 1 is the
-- primary diagnosis (copied to visits.diagnosis / icd10_code on sign for the visit list).
CREATE TABLE visit_diagnoses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id     uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  position     integer NOT NULL CHECK (position >= 1),
  kind         text NOT NULL CHECK (kind IN ('icd10', 'misc')),
  icd10_code   text,
  label        text NOT NULL CHECK (length(btrim(label)) > 0),
  UNIQUE (visit_id, position),
  CHECK ((kind = 'icd10') = (icd10_code IS NOT NULL))
);

CREATE TRIGGER visit_diagnoses_signed_guard
  BEFORE INSERT OR UPDATE OR DELETE ON visit_diagnoses
  FOR EACH ROW EXECUTE FUNCTION swasthyaiq_guard_child_of_signed_visit();

-- Offline drafts: the app sends the device time of each edit. An older save of the same
-- field (or of the diagnosis list) never overwrites a newer one, whatever order they arrive in.
ALTER TABLE consult_fields ADD COLUMN client_updated_at timestamptz;
ALTER TABLE visits ADD COLUMN diagnoses_client_updated_at timestamptz;

-- Amendments are additions; once written they are never changed. Only "Clear test visits"
-- may delete them (through the visit cascade).
CREATE FUNCTION swasthyaiq_guard_amendment() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND swasthyaiq_test_clear_allowed() THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'visit_amendments are append-only'
    USING ERRCODE = 'check_violation';
END $$;

CREATE TRIGGER visit_amendments_append_only
  BEFORE UPDATE OR DELETE ON visit_amendments
  FOR EACH ROW EXECUTE FUNCTION swasthyaiq_guard_amendment();
