const { execSync } = require('child_process');
const path = require('path');
const { app, db, request, cleanup } = require('./helpers');

afterEach(() => jest.restoreAllMocks());
afterAll(cleanup);

describe('l\'application survit à une panne de la base', () => {
  test('une connexion PostgreSQL perdue ne fait pas planter le processus', () => {
    // Quand PostgreSQL s'arrête, le pool émet "error" sur ses connexions au repos.
    // Sans écouteur, Node.js traite cet événement comme une exception et arrête le processus.
    expect(db.pool.listenerCount('error')).toBeGreaterThan(0);
    expect(() => db.pool.emit('error', new Error('terminating connection due to administrator command')))
      .not.toThrow();
  });

  test('pendant la panne, /health répond 503 au lieu de ne plus répondre', async () => {
    jest.spyOn(db, 'query').mockRejectedValue(new Error('connect ECONNREFUSED'));
    db.pool.emit('error', new Error('terminating connection due to administrator command'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('DOWN');
  });

  test('si le processus s\'arrête quand même, Docker le relance', () => {
    const json = execSync('docker compose config --format json', {
      cwd: path.join(__dirname, '..', '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    const { app: service, db: database, migrate } = JSON.parse(json).services;

    expect(service.restart).toBe('unless-stopped');
    expect(database.restart).toBe('unless-stopped');
    expect(migrate.restart).toBe('no');
  });
});
