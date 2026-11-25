-- DIG-53: each diagnosis on a visit is tagged Primary / Co-morbidity and Provisional / Final,
-- carries the date it was made, and (for eye diagnoses) the eye: OD / OS / OU.
-- ADD COLUMN with a default does not fire row triggers, so signed visits are not touched.
ALTER TABLE visit_diagnoses
  ADD COLUMN role         text NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'comorbidity')),
  ADD COLUMN certainty    text NOT NULL DEFAULT 'final' CHECK (certainty IN ('provisional', 'final')),
  ADD COLUMN eye          text CHECK (eye IN ('OD', 'OS', 'OU')),
  ADD COLUMN diagnosed_on date;
