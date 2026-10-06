const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db/pool');

afterAll(() => db.pool.end());

describe('SF-101 : authentification par clé API', () => {
  test('un appel avec une clé API valide est accepté', async () => {
    const res = await request(app)
      .get('/api/v1/claims')
      .set('X-API-Key', process.env.EXPERTAUTO_API_KEY);
      expect(res.status).toBe(200);
 
  });
});
