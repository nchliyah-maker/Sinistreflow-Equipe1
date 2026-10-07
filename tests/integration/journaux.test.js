const {
  app, db, request, partner, cleanup,
} = require('./helpers');
const logger = require('../../src/logger');

let lines;

beforeEach(() => {
  process.env.LOG_LEVEL = 'info';
  lines = [];
  jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.LOG_LEVEL;
});

afterAll(cleanup);

/** Les événements journalisés, une fois le JSON relu. */
const events = () => lines.map((line) => JSON.parse(line));
const requests = () => events().filter((event) => event.msg === 'requête');

describe('SF-504 : format des journaux', () => {
  test('une ligne JSON par événement, avec horodatage, niveau et message', () => {
    logger.info('dossier créé', { reference: 'SIN-2026-000461', montant: 125050 });

    expect(lines).toHaveLength(1);
    expect(lines[0].endsWith('\n')).toBe(true);
    expect(lines[0].trim()).not.toContain('\n');
    expect(JSON.parse(lines[0])).toEqual({
      time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      level: 'info',
      msg: 'dossier créé',
      reference: 'SIN-2026-000461',
      montant: 125050,
    });
  });

  test('une erreur est journalisée avec son nom, son message et sa pile', () => {
    logger.error('échec', { err: new TypeError('valeur inattendue') });

    const [event] = events();
    expect(event.level).toBe('error');
    expect(event.err.name).toBe('TypeError');
    expect(event.err.message).toBe('valeur inattendue');
    expect(event.err.stack).toContain('journaux.test.js');
  });

  test('le niveau filtre les événements moins importants', () => {
    logger.debug('détail');
    process.env.LOG_LEVEL = 'error';
    logger.info('information');
    logger.warn('avertissement');
    logger.error('erreur');

    expect(events().map((event) => event.msg)).toEqual(['erreur']);
  });

  test('pendant les tests, les journaux sont coupés par défaut', () => {
    delete process.env.LOG_LEVEL;
    logger.error('silencieux');

    expect(lines).toHaveLength(0);
  });
});

describe('SF-504 : journal des requêtes', () => {
  test('requête réussie : méthode, route, statut, durée et partenaire', async () => {
    await partner('get', '/api/v2/claims/SIN-2026-000450');

    expect(requests()).toEqual([{
      time: expect.any(String),
      level: 'info',
      msg: 'requête',
      method: 'GET',
      route: '/api/v2/claims/:reference',
      path: '/api/v2/claims/SIN-2026-000450',
      status: 200,
      durationMs: expect.any(Number),
      partner: 'ExpertAuto',
    }]);
  });

  test('la clé API n\'apparaît jamais dans les journaux', async () => {
    await partner('get', '/api/v1/claims?limit=1');
    await request(app).get('/api/v1/claims').set('X-API-Key', 'ea_live_cle_refusee');

    lines.forEach((line) => {
      expect(line).not.toContain(process.env.EXPERTAUTO_API_KEY);
      expect(line).not.toContain('ea_live_cle_refusee');
    });
  });

  test('erreur du client (404) : niveau warn, sans pile d\'appels', async () => {
    await partner('get', '/api/v3/claims/SIN-1999-000000');

    const refused = events().find((event) => event.msg === 'requête refusée');
    expect(refused.level).toBe('warn');
    expect(refused.status).toBe(404);
    expect(refused.error).toBe('Dossier SIN-1999-000000 introuvable');
    expect(JSON.stringify(events())).not.toContain('"stack"');
    expect(requests()[0].level).toBe('warn');
  });

  test('les sondes /health et /metrics ne remplissent pas les journaux', async () => {
    await request(app).get('/health');
    await request(app).get('/metrics');

    expect(requests()).toHaveLength(0);
  });
});

describe('SF-504 : erreur serveur (500)', () => {
  test('la pile d\'appels va dans les journaux, pas dans la réponse', async () => {
    jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('connexion perdue avec db:5432'));

    const res = await partner('get', '/api/v1/claims');

    // la réponse ne donne aucun détail technique (docs/API.md)
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erreur interne du serveur' });

    // le journal contient de quoi diagnostiquer
    const failure = events().find((event) => event.msg === 'erreur serveur');
    expect(failure.level).toBe('error');
    expect(failure.method).toBe('GET');
    expect(failure.path).toBe('/api/v1/claims');
    expect(failure.err.message).toBe('connexion perdue avec db:5432');
    expect(failure.err.stack).toContain('Error: connexion perdue');
    expect(requests()[0]).toMatchObject({ level: 'error', status: 500 });
  });
});
