-- DIG-50: tests ordered from the consult form are saved with the draft. Like the diagnosis list,
-- the investigations list carries the device time of its last edit so an older offline save
-- never overwrites a newer one.
ALTER TABLE visits ADD COLUMN investigations_client_updated_at timestamptz;
