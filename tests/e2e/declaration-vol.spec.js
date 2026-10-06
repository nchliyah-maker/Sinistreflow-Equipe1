const { test, expect } = require('@playwright/test');
const {
  day, database, identify, submit, confirmedReference,
} = require('./helpers');

const db = database();
test.afterAll(() => db.cleanup());

test('SF-301 : un assuré déclare un cambriolage avec son numéro de plainte', async ({ page }) => {
  await identify(page, 'MA-HAB-002001', 'lucas.bernard@example.test');

  // Étape 2 : le sinistre (un vol doit être déclaré sous 2 jours)
  await page.getByLabel('Type de sinistre').selectOption('CAMBRIOLAGE');
  await page.getByLabel('Date du sinistre').fill(day(-1).iso);
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
  await submit(page, '1 250,50');

  // Confirmation : pas d'erreur, une référence de dossier est affichée
  await expect(page.getByTestId('error')).toBeHidden();
  const reference = await confirmedReference(page, db);

  // Le numéro de plainte saisi est bien enregistré avec le dossier
  const { rows } = await db.query('SELECT complaint_number FROM claims WHERE reference = $1', [reference]);
  expect(rows[0].complaint_number).toBe('PV-2026-01234');
});

test('le champ "numéro de plainte" n\'est pas proposé pour un dégât des eaux', async ({ page }) => {
  await identify(page, 'MA-HAB-002001', 'lucas.bernard@example.test');

  await page.getByLabel('Type de sinistre').selectOption('DEGAT_DES_EAUX');
  await page.getByLabel('Date du sinistre').fill(day(-1).iso);
  await page.getByTestId('next-2').click();

  await expect(page.getByLabel('Décrivez les circonstances et les dommages')).toBeVisible();
  await expect(page.getByLabel('Numéro de dépôt de plainte')).toBeHidden();
});
