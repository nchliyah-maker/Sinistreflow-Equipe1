-- 5 : franchise contractuelle (en euros, comme dans l'outil de souscription)
ALTER TABLE contracts ADD COLUMN franchise_eur INTEGER NOT NULL DEFAULT 150;
