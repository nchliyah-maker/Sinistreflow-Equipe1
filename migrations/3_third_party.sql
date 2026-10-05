-- 3 : tiers impliqué + numéro de dépôt de plainte
ALTER TABLE claims
  ADD COLUMN third_party_involved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN third_party_name     VARCHAR(160),
  ADD COLUMN third_party_insurer  VARCHAR(160),
  ADD COLUMN complaint_number     VARCHAR(40);
