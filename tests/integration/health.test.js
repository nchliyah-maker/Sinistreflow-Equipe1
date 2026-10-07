const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db/pool');

afterEach(() => jest.restoreAllMocks());
afterAll(() => db.pool.end());

describe('SF-115 : /health vérifie la base de données', () => {
  test('base joignable : 200 et statut UP', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.database).toBe('UP');
    expect(res.body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('base en panne : 503 et statut DOWN', async () => {
    jest.spyOn(db, 'query').mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('DOWN');
    expect(res.body.database).toBe('DOWN');
  });

  test('base en panne : la réponse ne donne aucun détail technique', async () => {
    jest.spyOn(db, 'query').mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/health');

    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|127\.0\.0\.1/);
  });
});

describe('/health répond vite, même quand la base ne répond plus du tout', () => {
  test('base muette (connexion qui ne revient jamais) : 503 en moins de 3 secondes', async () => {
    // Cas vu pendant le test de panne sur la VM : conteneur de la base arrêté,
    // la tentative de connexion reste en attente au lieu d'être refusée.
    jest.spyOn(db, 'query').mockImplementation(() => new Promise(() => {}));
    const start = Date.now();

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.database).toBe('DOWN');
    expect(Date.now() - start).toBeLessThan(3000);
  }, 10000);
});
