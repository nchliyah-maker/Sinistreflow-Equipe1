const { test, expect } = require('@playwright/test');
const { config, day, database } = require('./helpers');

const db = database();
test.afterAll(() => db.cleanup());

async function login(page, user = config.backoffice.user, password = config.backoffice.password) {
  await page.goto('/backoffice.html');
  await page.getByLabel('Identifiant').fill(user);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

/** Lance une recherche et attend la réponse du serveur : la liste affichée est alors à jour. */
async function search(page, { text, status } = {}) {
  if (text !== undefined) await page.getByPlaceholder('Référence, n° de contrat ou nom de l\'assuré').fill(text);
  if (status !== undefined) await page.locator('#status').selectOption(status);
  const response = page.waitForResponse((res) => res.url().includes('/api/internal/claims?'));
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await response;
}

/** Crée un dossier par l'API publique, pour ne pas modifier un dossier du dump. */
async function newClaim(request) {
  const res = await request.post('/api/public/claims', {
    data: {
      contractNumber: 'MA-AUTO-001001',
      email: 'camille.durand@example.test',
      type: 'AUTO_COLLISION',
      incidentDate: day(-1).iso,
      description: 'Collision au carrefour, pare-chocs avant enfoncé.',
      vehicle: { plate: 'AB-123-CD', brand: 'Renault', model: 'Clio' },
      estimatedAmount: '1 250,50',
    },
  });
  expect(res.status()).toBe(201);
  const { reference } = await res.json();
  db.created.push(reference);
  return reference;
}

test('un mauvais mot de passe est refusé', async ({ page }) => {
  await login(page, config.backoffice.user, 'mauvais-mot-de-passe');

  await expect(page.locator('#error')).toContainText('Identifiants gestionnaire invalides');
  await expect(page.locator('#app')).toBeHidden();
});

test('le gestionnaire recherche un dossier et change son statut', async ({ page, request }) => {
  const reference = await newClaim(request);

  await login(page);
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#rows tr')).toHaveCount(20);

  // Recherche par référence : une seule ligne
  await search(page, { text: reference });
  await expect(page.locator('#rows tr')).toHaveCount(1);
  await expect(page.locator('#rows tr')).toContainText(reference);
  await expect(page.locator('#rows tr')).toContainText(day(-1).fr);

  // Détail du dossier
  await page.locator('#rows tr').click();
  const detail = page.locator('#detail');
  await expect(detail.locator('h1')).toHaveText(reference);
  await expect(detail.locator('.badge').first()).toHaveText('DECLARE');
  await expect(detail).toContainText('AB-123-CD Renault Clio');
  await expect(detail).toContainText(/1\s250,50\s€/);

  // Changement de statut
  await detail.getByRole('button', { name: '→ EN_INSTRUCTION' }).click();
  await expect(detail.locator('.badge').first()).toHaveText('EN_INSTRUCTION');
  await expect(detail.getByRole('button', { name: '→ EXPERTISE_EN_COURS' })).toBeVisible();

  const { rows } = await db.query('SELECT status FROM claims WHERE reference = $1', [reference]);
  expect(rows[0].status).toBe('EN_INSTRUCTION');
});

test('SF-108 : rechercher un nom avec une apostrophe fonctionne', async ({ page }) => {
  await login(page);

  await search(page, { text: 'D\'Almeida' });

  await expect(page.locator('#error')).toBeHidden();
  await expect(page.locator('#rows tr')).not.toHaveCount(0);
  await expect(page.locator('#rows tr')).not.toHaveCount(20);
});

test('SF-107 : le filtre EXPERTISE_EN_COURS affiche bien des dossiers', async ({ page }) => {
  await login(page);

  await search(page, { status: 'EXPERTISE_EN_COURS' });

  await expect(page.locator('#rows tr')).not.toHaveCount(0);
  await expect(page.locator('#rows tr').filter({ hasNotText: 'EXPERTISE_EN_COURS' })).toHaveCount(0);
});

test('SF-105 : un dossier refusé ne propose pas le bouton d\'indemnisation', async ({ page }) => {
  await login(page);

  await search(page, { text: 'SIN-2024-000212' });
  await expect(page.locator('#rows tr')).toHaveCount(1);
  await page.locator('#rows tr').click();

  const detail = page.locator('#detail');
  await expect(detail.locator('.badge').first()).toHaveText('REFUSE');
  await expect(detail.getByRole('button', { name: '→ CLOS' })).toBeVisible();
  await expect(detail.getByRole('button', { name: '→ INDEMNISE' })).toHaveCount(0);
});
