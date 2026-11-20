-- DIG-39: appointment and check-in times on the queue (fictitious, regenerated daily), and a
-- "Not arrived" status for patients who have an appointment but have not checked in.
ALTER TABLE queue_entries
  ADD COLUMN appointment_at timestamptz,
  ADD COLUMN checked_in_at  timestamptz;

UPDATE queue_entries SET appointment_at = now(), checked_in_at = now();

ALTER TABLE queue_entries ALTER COLUMN appointment_at SET NOT NULL;

ALTER TABLE queue_entries DROP CONSTRAINT queue_entries_status_check;
ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_status_check
  CHECK (status IN ('not_arrived', 'waiting', 'in_consult', 'done'));
-- Not arrived exactly when there is no check-in time.
ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_checked_in_check
  CHECK ((status = 'not_arrived') = (checked_in_at IS NULL));
