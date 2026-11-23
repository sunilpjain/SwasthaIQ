-- DIG-40: past conditions with a status the doctor can update, and investigations ordered on a
-- visit (for "pending tests" on the patient summary).

-- ---------------------------------------------------------------- conditions
CREATE TABLE patient_conditions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (length(btrim(name)) > 0),
  icd10_code   text,
  status       text NOT NULL CHECK (status IN ('active', 'controlled', 'resolved')),
  since        date,
  is_seed      boolean NOT NULL DEFAULT false,
  updated_by   uuid REFERENCES users(id),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- clock_timestamp, not now(): conditions added in one transaction keep the order they were given.
  created_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (patient_id, name)
);

-- Every status a condition has had, oldest first. Append-only.
CREATE TABLE patient_condition_history (
  id            bigserial PRIMARY KEY,
  condition_id  uuid NOT NULL REFERENCES patient_conditions(id) ON DELETE CASCADE,
  status        text NOT NULL CHECK (status IN ('active', 'controlled', 'resolved')),
  changed_by    uuid REFERENCES users(id),
  changed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_condition_history_idx ON patient_condition_history (condition_id, changed_at);

CREATE FUNCTION swasthyaiq_guard_condition_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND swasthyaiq_test_clear_allowed() THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'patient_condition_history is append-only'
    USING ERRCODE = 'check_violation';
END $$;

CREATE TRIGGER patient_condition_history_append_only
  BEFORE UPDATE OR DELETE ON patient_condition_history
  FOR EACH ROW EXECUTE FUNCTION swasthyaiq_guard_condition_history();

-- Move the old text array across. "X (past)" becomes X, resolved (same rule as seedConditions()).
INSERT INTO patient_conditions (patient_id, name, status, is_seed)
SELECT p.id,
       regexp_replace(c.name, '\s*\(past\)$', ''),
       CASE WHEN c.name ~ '\(past\)$' THEN 'resolved' ELSE 'active' END,
       p.is_seed
FROM patients p, unnest(p.conditions) WITH ORDINALITY AS c(name, n)
ORDER BY p.id, c.n
ON CONFLICT (patient_id, name) DO NOTHING;

INSERT INTO patient_condition_history (condition_id, status, changed_by, changed_at)
SELECT id, status, NULL, created_at FROM patient_conditions;

ALTER TABLE patients DROP COLUMN conditions;

-- ---------------------------------------------------------------- investigation orders
-- One row per test ordered on a visit. test_code matches lab_values.test_code when the test
-- has a lab result (e.g. ALT, HBA1C); imaging and other tests have no code.
CREATE TABLE investigation_orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id    uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  position    integer NOT NULL CHECK (position >= 1),
  test_name   text NOT NULL CHECK (length(btrim(test_name)) > 0),
  test_code   text,
  UNIQUE (visit_id, position)
);

-- Seed visits already in the database are signed, so their orders go in before the guard
-- trigger exists. Keep in step with `investigations` in src/seed/seed-data.ts (fresh databases
-- get them from the seed instead, when this finds no visits).
INSERT INTO investigation_orders (visit_id, position, test_name, test_code)
SELECT v.id, o.position, o.test_name, o.test_code
FROM (VALUES
  ('G2', DATE '2026-10-23', 1, 'Complete blood count', 'HB'),
  ('G2', DATE '2026-10-23', 2, 'Liver function tests', 'ALT'),
  ('G2', DATE '2026-10-23', 3, 'ECG', NULL),
  ('G3', DATE '2026-07-10', 1, 'Liver function tests', 'ALT'),
  ('G6', DATE '2026-09-11', 1, 'HbA1c', 'HBA1C'),
  ('E2', DATE '2026-10-16', 1, 'OCT macula', NULL)
) AS o(token, visit_date, position, test_name, test_code)
JOIN patients p ON p.token = o.token
JOIN visits v ON v.patient_id = p.id AND v.visit_date = o.visit_date AND v.is_seed;

CREATE TRIGGER investigation_orders_signed_guard
  BEFORE INSERT OR UPDATE OR DELETE ON investigation_orders
  FOR EACH ROW EXECUTE FUNCTION swasthyaiq_guard_child_of_signed_visit();
