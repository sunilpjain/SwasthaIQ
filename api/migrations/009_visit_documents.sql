-- DIG-72: the A4 consultation summary PDF of each signed version, rendered by a background job
-- into the private files bucket. One row per visit version; a re-render replaces nothing (the key
-- is fixed per version). Print-copy edits (DIG-73) are never stored: they are rendered on request.
CREATE TABLE visit_documents (
  visit_id    uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  version     integer NOT NULL,
  s3_key      text NOT NULL,
  bytes       integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_id, version)
);
