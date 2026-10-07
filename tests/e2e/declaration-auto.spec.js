const { test, expect } = require('@playwright/test');
const {
  day, database, identify, submit, confirmedReference,
} = require('./helpers');

const db = database();
test.afterAll(() => db.cleanup());

/** Étapes 2 et 3 d'un accident auto, avec des valeurs valides par défaut. */
async function fillAccident(page, { date = day(-1).iso, plate = 'AB-123-CD', description } = {}) {
  await page.getByLabel('Type de sinistre').selectOption('AUTO_COLLISION');
  await page.getByLabel('Date du sinistre').fill(date);
  await page.getByLabel('Lieu du sinistre').fill('Carrefour de la gare, Grenoble');
  await page.getByLabel('Immatriculation').fill(plate);
  await page.getByLabel('Marque').fill('Renault');
  await page.getByLabel('Modèle').fill('Clio');
  await page.getByTestId('next-2').click();

  await page.getByLabel('Décrivez les circonstances et les dommages')
    .fill(description || 'Collision au carrefour, pare-chocs avant enfoncé.');
  await page.getByTestId('next-3').click();
}

test('un assuré déclare un accident auto de bout en bout', async ({ page }) => {
  await identify(page, 'MA-AUTO-001001', 'camille.durand@example.test');
  await expect(page.locator('#holder-greeting')).toContainText('Bonjour Camille');

  await fillAccident(page);

  // Récapitulatif avant envoi
  await expect(page.locator('#recap')).toContainText('MA-AUTO-001001');
  await expect(page.locator('#recap')).toContainText('AB-123-CD');
  await expect(page.locator('#recap')).toContainText(day(-1).fr);
  await submit(page, '1 250,50');

  const reference = await confirmedReference(page, db);

  // SF-111 (écran) : la date affichée est celle saisie, pas la veille
  await expect(page.locator('#confirm-recap')).toContainText(day(-1).fr);
  // SF-113 (écran) : le montant saisi au format français est bien compris
  await expect(page.locator('#confirm-recap')).toContainText(/1\s250,50\s€/);
  // SF-103 (écran) : une déclaration faite le lendemain n'est pas tardive
  await expect(page.locator('#late-warning')).toBeHidden();

  const { rows } = await db.query(
    `SELECT c.status, c.estimated_amount_cents, v.plate_number
     FROM claims c JOIN vehicles v ON v.claim_id = c.id WHERE c.reference = $1`,
    [reference],
  );
  expect(rows[0].status).toBe('DECLARE');
  expect(Number(rows[0].estimated_amount_cents)).toBe(125050);
  expect(rows[0].plate_number).toBe('AB-123-CD');
});

test('une déclaration faite après le délai affiche l\'avertissement "tardive"', async ({ page }) => {
  await identify(page, 'MA-AUTO-001001', 'camille.durand@example.test');
  await fillAccident(page, { date: day(-10).iso });
  await submit(page, '800');

  await confirmedReference(page, db);
  await expect(page.locator('#late-warning')).toBeVisible();
});

test('un contrat suspendu ne peut pas déclarer de sinistre', async ({ page }) => {
  await identify(page, 'MA-HAB-002003', 'theo.garnier@example.test');

  await expect(page.getByTestId('error')).toContainText('Le contrat MA-HAB-002003 n\'est plus actif');
  await expect(page.getByLabel('Type de sinistre')).toBeHidden();
});

test('un email qui ne correspond pas au contrat est refusé', async ({ page }) => {
  await identify(page, 'MA-AUTO-001001', 'quelqu.un.dautre@example.test');

  await expect(page.getByTestId('error')).toContainText('Aucun contrat ne correspond');
});

test('erreur de validation : description trop courte, on reste à l\'étape 3', async ({ page }) => {
  await identify(page, 'MA-AUTO-001001', 'camille.durand@example.test');
  await page.getByLabel('Type de sinistre').selectOption('BRIS_DE_GLACE');
  await page.getByLabel('Date du sinistre').fill(day(-1).iso);
  await page.getByLabel('Immatriculation').fill('AB-123-CD');
  await page.getByTestId('next-2').click();

  await page.getByLabel('Décrivez les circonstances et les dommages').fill('Trop court');
  await page.getByTestId('next-3').click();

  await expect(page.getByTestId('error')).toContainText('La description doit faire au moins 20 caractères');
  await expect(page.getByTestId('submit')).toBeHidden();
});

test('erreur de validation du serveur : immatriculation invalide, rien n\'est créé', async ({ page }) => {
  const before = await db.query('SELECT count(*) AS n FROM claims');

  await identify(page, 'MA-AUTO-001001', 'camille.durand@example.test');
  await fillAccident(page, { plate: '1234 AB 38' });
  await submit(page, '500');

  await expect(page.getByTestId('error')).toContainText('Déclaration invalide');
  await expect(page.getByTestId('error')).toContainText('Immatriculation invalide (format AA-123-AA)');
  await expect(page.getByTestId('confirmation')).toBeHidden();

  const after = await db.query('SELECT count(*) AS n FROM claims');
  expect(after.rows[0].n).toBe(before.rows[0].n);
});
