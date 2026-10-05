-- 7 : expertises réalisées par les partenaires + indemnité calculée
CREATE TABLE expertises (
  id                     SERIAL PRIMARY KEY,
  claim_id               INTEGER     NOT NULL UNIQUE REFERENCES claims(id) ON DELETE CASCADE,
  expert_name            VARCHAR(160) NOT NULL,
  appointment_date       DATE        NOT NULL,
  assessed_amount_cents  BIGINT      NOT NULL,
  conclusion             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE claims ADD COLUMN indemnity_cents BIGINT;
