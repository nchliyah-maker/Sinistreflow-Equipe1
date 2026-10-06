const { test, expect } = require('@playwright/test');
const db = require('../../src/db/pool');

const created = [];

test.afterAll(async () => {
  await db.query('DELETE FROM claims WHERE reference = ANY($1)', [created]);
  await db.pool.end();
});

/** Date d'hier au format AAAA-MM-JJ (un vol doit être déclaré sous 2 jours). */
function yesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

test('SF-301 : un assuré déclare un cambriolage avec son numéro de plainte', async ({ page }) => {
  await page.goto('/');

  // Étape 1 : identification
  await page.getByLabel('Numéro de contrat').fill('MA-HAB-002001');
  await page.getByLabel('Adresse email').fill('lucas.bernard@example.test');
  await page.getByTestId('next-1').click();

  // Étape 2 : le sinistre
  await page.getByLabel('Type de sinistre').selectOption('CAMBRIOLAGE');
  await page.getByLabel('Date du sinistre').fill(yesterday());
  await page.getByLabel('Lieu du sinistre').fill('12 rue Victor Hugo, Grenoble');
  await page.getByTestId('next-2').click();

  // Étape 3 : circonstances, le champ "plainte" apparaît pour un vol
  await page.getByLabel('Décrivez les circonstances et les dommages')
    .fill('Porte fracturée pendant la nuit, ordinateur et bijoux volés.');
  await expect(page.getByLabel('Numéro de dépôt de plainte')).toBeVisible();
  await page.getByLabel('Numéro de dépôt de plainte').fill('PV-2026-01234');
  await page.getByTestId('next-3').click();

  // Étape 4 : récapitulatif et envoi
  await expect(page.locator('#recap')).toContainText('PV-2026-01234');
  await page.getByLabel('Montant estimé des dommages (€)').fill('1 250,50');
  await page.getByLabel('Je certifie l\'exactitude des informations déclarées').check();
  await page.getByTestId('submit').click();

  // Confirmation : pas d'erreur, une référence de dossier est affichée
  await expect(page.getByTestId('error')).toBeHidden();
  await expect(page.getByTestId('reference')).toHaveText(/^SIN-\d{4}-\d{6}$/);
  const reference = await page.getByTestId('reference').innerText();
  created.push(reference);

  // Le numéro de plainte saisi est bien enregistré avec le dossier
  const { rows } = await db.query('SELECT complaint_number FROM claims WHERE reference = $1', [reference]);
  expect(rows[0].complaint_number).toBe('PV-2026-01234');
});
