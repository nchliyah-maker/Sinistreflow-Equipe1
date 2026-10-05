-- 1 : schéma initial (2021)
CREATE TABLE policyholders (
  id          SERIAL PRIMARY KEY,
  first_name  VARCHAR(80)  NOT NULL,
  last_name   VARCHAR(80)  NOT NULL,
  email       VARCHAR(160) NOT NULL UNIQUE,
  phone       VARCHAR(20),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE contracts (
  id               SERIAL PRIMARY KEY,
  contract_number  VARCHAR(20) NOT NULL UNIQUE,
  policyholder_id  INTEGER     NOT NULL REFERENCES policyholders(id),
  product          VARCHAR(20) NOT NULL CHECK (product IN ('AUTO', 'HABITATION')),
  status           VARCHAR(20) NOT NULL DEFAULT 'ACTIF' CHECK (status IN ('ACTIF', 'SUSPENDU', 'RESILIE')),
  start_date       DATE        NOT NULL,
  end_date         DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE claims (
  id                      SERIAL PRIMARY KEY,
  reference               VARCHAR(20) NOT NULL UNIQUE,
  contract_id             INTEGER     NOT NULL REFERENCES contracts(id),
  claim_type              VARCHAR(30) NOT NULL,
  incident_date           DATE        NOT NULL,
  declared_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  description             TEXT        NOT NULL,
  status                  VARCHAR(30) NOT NULL DEFAULT 'DECLARE',
  estimated_amount_cents  BIGINT,
  immatriculation         VARCHAR(15)
);

CREATE INDEX idx_claims_contract ON claims(contract_id);
