-- DIG-71: advisory Rx warnings (allergy class, duplicate) never block; when the doctor signs or
-- saves an edit past one, it is logged here. Rule ids only, never clinical text. Append-only.
CREATE TABLE rx_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id      uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  rx_line_id    uuid NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('allergy', 'duplicate')),
  rule          text NOT NULL CHECK (rule ~ '^[a-z0-9:-]{1,64}$'),
  overridden_by uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rx_overrides_visit ON rx_overrides (visit_id);

CREATE FUNCTION rx_overrides_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND swasthyaiq_test_clear_allowed() THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'rx_overrides is append-only' USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rx_overrides_append_only
  BEFORE UPDATE OR DELETE ON rx_overrides
  FOR EACH ROW EXECUTE FUNCTION rx_overrides_append_only();
