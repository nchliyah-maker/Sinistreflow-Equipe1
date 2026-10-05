-- 4 : historique des changements de statut
CREATE TABLE claim_status_history (
  id           SERIAL PRIMARY KEY,
  claim_id     INTEGER     NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  from_status  VARCHAR(30),
  to_status    VARCHAR(30) NOT NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by   VARCHAR(80) NOT NULL
);

CREATE INDEX idx_history_claim ON claim_status_history(claim_id);
