-- 8 : les véhicules sortent de la table claims (projet API v3, mars 2025)
CREATE TABLE vehicles (
  id            SERIAL PRIMARY KEY,
  claim_id      INTEGER     NOT NULL UNIQUE REFERENCES claims(id) ON DELETE CASCADE,
  plate_number  VARCHAR(15) NOT NULL,
  brand         VARCHAR(60),
  model         VARCHAR(60)
);

-- reprise de l'existant
INSERT INTO vehicles (claim_id, plate_number)
SELECT id, immatriculation FROM claims WHERE immatriculation IS NOT NULL;

COMMENT ON COLUMN claims.immatriculation IS 'OBSOLETE depuis la migration 8 : ne plus alimenter, utiliser vehicles.plate_number';
