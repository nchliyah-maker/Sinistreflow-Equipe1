const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db/pool');

afterAll(() => db.pool.end());

describe('SF-114 : codes HTTP et stack trace', () => {
  test('un appel sans clé API répond 401', async () => {
    const res = await request(app).get('/api/v1/claims');
    expect(res.status).toBe(401);
  });

  test('la réponse ne contient pas la stack trace', async () => {
    const res = await request(app).get('/api/v1/claims');
    expect(res.body).not.toHaveProperty('stack');
  });
});
    