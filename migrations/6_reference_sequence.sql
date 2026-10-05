-- 6 : séquence dédiée aux références de dossier
-- TODO (ticket SF-58) : brancher le code sur cette séquence au lieu du COUNT(*)
CREATE SEQUENCE claim_reference_seq START WITH 1;
SELECT setval('claim_reference_seq',
              GREATEST(1, COALESCE((SELECT MAX(CAST(split_part(reference, '-', 3) AS INTEGER)) FROM claims), 0)),
              (SELECT COUNT(*) > 0 FROM claims));

-- Le numéro de dossier (sans l'année) est celui communiqué par téléphone à l'assuré :
-- il doit rester unique toutes années confondues.
CREATE UNIQUE INDEX uq_claims_reference_number ON claims ((split_part(reference, '-', 3)));
