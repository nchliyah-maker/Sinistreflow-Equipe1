const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db/pool');
const config = require('../../src/config');

afterAll(() => db.pool.end());

function search(q) {
  return request(app)
    .get('/api/internal/claims')
    .query({ q })
    .auth(config.backoffice.user, config.backoffice.password);
}

describe('SF-108 : recherche du back-office', () => {
  test('un nom avec une apostrophe ne provoque plus d\'erreur', async () => {
    const res = await search("D'Almeida");

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    res.body.items.forEach((item) => expect(item.holder).toMatch(/d'almeida/i));
  });

  test('une injection SQL ne renvoie aucun dossier', async () => {
    const res = await search("%' OR 1=1 --");

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  test('la recherche par numéro de contrat fonctionne toujours', async () => {
    const res = await search('MA-AUTO-001001');

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    res.body.items.forEach((item) => expect(item.contractNumber).toBe('MA-AUTO-001001'));
  });
});
