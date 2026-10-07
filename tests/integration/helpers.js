const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db/pool');
const config = require('../../src/config');

const created = [];

/** Requête à l'API partenaires avec la clé d'ExpertAuto. */
const partner = (method, url) => request(app)[method](url).set('X-API-Key', process.env.EXPERTAUTO_API_KEY);

/** Requête à l'API interne avec le compte gestionnaire. */
const backoffice = (method, url) => request(app)[method](url)
  .auth(config.backoffice.user, config.backoffice.password);

/** Date locale au format AAAA-MM-JJ, décalée de `offset` jours par rapport à aujourd'hui. */
function day(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${String(date.getDate()).padStart(2, '0')}`;
}

const autoDeclaration = (overrides = {}) => ({
  contractNumber: 'MA-AUTO-001001',
  email: 'camille.durand@example.test',
  type: 'AUTO_COLLISION',
  incidentDate: day(-1),
  incidentLocation: 'rue Victor Hugo, Grenoble',
  description: 'Collision au carrefour, pare-chocs avant enfoncé.',
  vehicle: { plate: 'AB-123-CD', brand: 'Renault', model: 'Clio' },
  thirdParty: { involved: false },
  estimatedAmount: '1 250,50',
  ...overrides,
});

/** Envoie une déclaration par l'API publique et mémorise le dossier pour le nettoyage. */
async function declare(overrides) {
  const res = await request(app).post('/api/public/claims').send(autoDeclaration(overrides));
  if (res.status === 201) created.push(res.body.reference);
  return res;
}

/** Fait avancer un dossier dans le workflow par le back-office. */
async function moveTo(reference, ...statuses) {
  for (const to of statuses) {
    // eslint-disable-next-line no-await-in-loop
    const res = await backoffice('post', `/api/internal/claims/${reference}/transition`).send({ to });
    if (res.status !== 200) throw new Error(`transition vers ${to} refusée : ${res.status}`);
  }
}

/** À appeler dans afterAll : supprime les dossiers créés et ferme la connexion. */
async function cleanup() {
  await db.query('DELETE FROM claims WHERE reference = ANY($1)', [created]);
  await db.pool.end();
}

module.exports = {
  app, db, request, partner, backoffice, day, autoDeclaration, declare, moveTo, cleanup,
};
