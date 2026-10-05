-- 10 : comptes partenaires (authentification par clé API) - sprint 42
CREATE TABLE partners (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(80) NOT NULL UNIQUE,
  api_key_hash  CHAR(64)    NOT NULL UNIQUE,
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ExpertAuto : clé transmise hors bande (sha256 stocké uniquement)
INSERT INTO partners (name, api_key_hash)
VALUES ('ExpertAuto', '4a5e56b62eea073637cbdcedba15d8286a36ceab388a9246ba4768d36f5401d0');

-- traçabilité : quel partenaire a réalisé l'expertise
ALTER TABLE expertises ADD COLUMN partner_id INTEGER REFERENCES partners(id);
