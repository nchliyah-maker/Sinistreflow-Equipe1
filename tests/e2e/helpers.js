/**
 * Outils communs aux tests end-to-end.
 * Les dossiers créés pendant un fichier de tests sont supprimés à la fin de ce fichier.
 */
const { Pool } = require('pg');
const { expect } = require('@playwright/test');
const config = require('../../src/config');

/** Date locale AAAA-MM-JJ décalée de `offset` jours, et la même au format français JJ/MM/AAAA. */
function day(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return { iso: `${date.getFullYear()}-${month}-${dd}`, fr: `${dd}/${month}/${date.getFullYear()}` };
}

/** Connexion à la base propre à un fichier de tests, avec la liste des dossiers à supprimer. */
function database() {
  const pool = new Pool(config.db);
  const created = [];
  return {
    created,
    query: (text, params) => pool.query(text, params),
    async cleanup() {
      await pool.query('DELETE FROM claims WHERE reference = ANY($1)', [created]);
      await pool.end();
    },
  };
}

/** Étape 1 du formulaire : identification de l'assuré. */
async function identify(page, contractNumber, email) {
  await page.goto('/');
  await page.getByLabel('Numéro de contrat').fill(contractNumber);
  await page.getByLabel('Adresse email').fill(email);
  await page.getByTestId('next-1').click();
}

/** Étape 4 : montant, certification, envoi. */
async function submit(page, amount) {
  if (amount) await page.getByLabel('Montant estimé des dommages (€)').fill(amount);
  await page.getByLabel('Je certifie l\'exactitude des informations déclarées').check();
  await page.getByTestId('submit').click();
}

/** Attend l'écran de confirmation et renvoie la référence du dossier créé. */
async function confirmedReference(page, db) {
  await expect(page.getByTestId('confirmation')).toBeVisible();
  await expect(page.getByTestId('reference')).toHaveText(/^SIN-\d{4}-\d{6}$/);
  const reference = await page.getByTestId('reference').innerText();
  db.created.push(reference);
  return reference;
}

module.exports = {
  config, day, database, identify, submit, confirmedReference,
};
