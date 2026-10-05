-- 9 : indicateur de déclaration tardive + index de recherche par statut
ALTER TABLE claims ADD COLUMN late_declaration BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_claims_status ON claims(status);
