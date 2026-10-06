const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db/pool');

afterAll(() => db.pool.end());

function verify(contractNumber, email) {
  return request(app).post('/api/public/contracts/verify').send({ contractNumber, email });
}

describe('SF-112 : identification de l\'assuré', () => {
  test('Camille Durand s\'identifie avec son email en minuscules', async () => {
    const res = await verify('MA-AUTO-001001', 'camille.durand@example.test');

    expect(res.status).toBe(200);
    expect(res.body.contractNumber).toBe('MA-AUTO-001001');
    expect(res.body.holder.lastName).toBe('Durand');
  });

  test('l\'email tel qu\'il est enregistré en base fonctionne aussi', async () => {
    const res = await verify('MA-AUTO-001001', 'Camille.Durand@Example.test');

    expect(res.status).toBe(200);
  });

  test('un email qui n\'est pas celui du contrat est refusé en 404', async () => {
    const res = await verify('MA-AUTO-001001', 'quelqu.un.dautre@example.test');

    expect(res.status).toBe(404);
  });
});
