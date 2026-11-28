-- DIG-70: prescription builder. Lines are generic-only (decision 20 Nov), so the brand becomes
-- optional; a line remembers the catalogue item it came from (DIG-69) and its route, which the
-- missing-eye check uses (DIG-71). The Rx list is saved whole, newest device edit wins, like the
-- diagnoses (DIG-41).
-- ADD COLUMN without a default and DROP NOT NULL do not fire row triggers, so signed visits are
-- not touched.
ALTER TABLE rx_lines
  ALTER COLUMN medicine_brand DROP NOT NULL,
  ADD COLUMN medicine_id text,
  ADD COLUMN route       text CHECK (route IN ('oral', 'eye'));

ALTER TABLE visits ADD COLUMN rx_client_updated_at timestamptz;
