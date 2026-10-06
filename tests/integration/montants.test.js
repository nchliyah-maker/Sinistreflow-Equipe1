const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db/pool');

afterAll(() => db.pool.end());

describe('SF-110 : les montants sont des nombres entiers', () => {
  test('v2 : estimatedAmountCents est un entier JSON', async () => {
    const res = await request(app)
      .get('/api/v2/claims/SIN-2026-000450')
      .set('X-API-Key', process.env.EXPERTAUTO_API_KEY);

    expect(res.status).toBe(200);
    expect(Number.isInteger(res.body.estimatedAmountCents)).toBe(true);
    expect(res.body.estimatedAmountCents).toBe(254900);
  });

  test('v2 : indemnityCents est un entier JSON quand il est renseigné', async () => {
    const { rows } = await db.query(
      'SELECT reference FROM claims WHERE indemnity_cents IS NOT NULL ORDER BY id LIMIT 1',
    );
    const res = await request(app)
      .get(`/api/v2/claims/${rows[0].reference}`)
      .set('X-API-Key', process.env.EXPERTAUTO_API_KEY);

    expect(res.status).toBe(200);
    expect(Number.isInteger(res.body.indemnityCents)).toBe(true);
  });

  test('la base renvoie les colonnes BIGINT sous forme de nombres', async () => {
    const { rows } = await db.query(
      "SELECT estimated_amount_cents FROM claims WHERE reference = 'SIN-2026-000450'",
    );

    expect(rows[0].estimated_amount_cents).toBe(254900);
  });
});
