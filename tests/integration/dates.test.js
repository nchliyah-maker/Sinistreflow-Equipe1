process.env.TZ = 'Europe/Paris';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db/pool');

afterAll(() => db.pool.end());

describe('SF-111 : les dates ne reculent pas d\'un jour', () => {
  test('v2 : incidentDate est la date enregistrée en base', async () => {
    const { rows } = await db.query(
      "SELECT to_char(incident_date, 'YYYY-MM-DD') AS jour FROM claims WHERE reference = 'SIN-2026-000450'",
    );
    const res = await request(app)
      .get('/api/v2/claims/SIN-2026-000450')
      .set('X-API-Key', process.env.EXPERTAUTO_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.incidentDate).toBe(rows[0].jour);
    expect(res.body.incidentDate).toBe('2026-08-07');
  });

  test('v1 : date_sinistre est la date enregistrée en base', async () => {
    const res = await request(app)
      .get('/api/v1/claims/SIN-2026-000450')
      .set('X-API-Key', process.env.EXPERTAUTO_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.date_sinistre).toBe('2026-08-07');
  });
});
