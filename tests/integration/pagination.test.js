const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db/pool');

afterAll(() => db.pool.end());

describe('SF-107 : pagination des listes', () => {
  test('la page 1 renvoie les dossiers annoncés par le total', async () => {
    const res = await request(app)
      .get('/api/v1/claims?statut=EXPERTISE_EN_COURS&page=1&limit=20')
      .set('X-API-Key', process.env.EXPERTAUTO_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.data.length).toBe(res.body.total);
  });
});
