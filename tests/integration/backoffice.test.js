process.env.TZ = 'Europe/Paris';

const {
  app, request, backoffice, declare, moveTo, cleanup,
} = require('./helpers');

afterAll(cleanup);

describe('back-office : authentification', () => {
  test('sans identifiants : 401', async () => {
    const res = await request(app).get('/api/internal/claims');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentification gestionnaire requise' });
  });

  test('mauvais mot de passe : 401 sans stack trace', async () => {
    const res = await request(app).get('/api/internal/claims').auth('gestionnaire', 'mauvais');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Identifiants gestionnaire invalides' });
  });

  test('bons identifiants : le gestionnaire est reconnu', async () => {
    const res = await backoffice('get', '/api/internal/me');

    expect(res.status).toBe(200);
    expect(typeof res.body.user).toBe('string');
  });
});

describe('back-office : liste des dossiers', () => {
  test('page 1 : 20 dossiers, les plus récents d\'abord', async () => {
    const res = await backoffice('get', '/api/internal/claims');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(20);
    expect(res.body.total).toBeGreaterThanOrEqual(425);
    const dates = res.body.items.map((item) => Date.parse(item.declaredAt));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  test('les pages se suivent sans doublon ni trou', async () => {
    const page1 = await backoffice('get', '/api/internal/claims?page=1');
    const page2 = await backoffice('get', '/api/internal/claims?page=2');
    const references = [...page1.body.items, ...page2.body.items].map((item) => item.reference);

    expect(new Set(references).size).toBe(40);
  });

  test('filtre par statut : seuls les dossiers refusés', async () => {
    const res = await backoffice('get', '/api/internal/claims?status=REFUSE');

    expect(res.body.items.length).toBeGreaterThan(0);
    res.body.items.forEach((item) => expect(item.status).toBe('REFUSE'));
  });

  test('recherche par référence', async () => {
    const res = await backoffice('get', '/api/internal/claims?q=SIN-2024-000212');

    expect(res.body.items.map((item) => item.reference)).toEqual(['SIN-2024-000212']);
  });
});

describe('back-office : détail et changement de statut', () => {
  test('détail d\'un dossier refusé : on ne peut que le clore (SF-105)', async () => {
    const res = await backoffice('get', '/api/internal/claims/SIN-2024-000212');

    expect(res.status).toBe(200);
    expect(res.body.internalStatus).toBe('REFUSE');
    expect(res.body.allowedTransitions).toEqual(['CLOS']);
    expect(res.body.claim.status).toBe('REJECTED');
  });

  test('dossier inconnu : 404', async () => {
    const res = await backoffice('get', '/api/internal/claims/SIN-1999-000000');

    expect(res.status).toBe(404);
  });

  test('transition autorisée : le statut change et l\'historique garde le gestionnaire', async () => {
    const { body } = await declare();

    const res = await backoffice('post', `/api/internal/claims/${body.reference}/transition`)
      .send({ to: 'EN_INSTRUCTION' });

    expect(res.status).toBe(200);
    expect(res.body.internalStatus).toBe('EN_INSTRUCTION');
    expect(res.body.allowedTransitions).toEqual(['EXPERTISE_EN_COURS', 'ACCEPTE', 'REFUSE']);
    const last = res.body.claim.history[res.body.claim.history.length - 1];
    expect(last.from).toBe('DECLARED');
    expect(last.to).toBe('UNDER_REVIEW');
    expect(last.by).toMatch(/^gestionnaire:/);
  });

  test('indemniser un dossier refusé : 409', async () => {
    const { body } = await declare();
    await moveTo(body.reference, 'REFUSE');

    const res = await backoffice('post', `/api/internal/claims/${body.reference}/transition`)
      .send({ to: 'INDEMNISE' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Transition interdite : REFUSE -> INDEMNISE');
  });

  test('statut inconnu : 409', async () => {
    const { body } = await declare();

    const res = await backoffice('post', `/api/internal/claims/${body.reference}/transition`)
      .send({ to: 'ARCHIVE' });

    expect(res.status).toBe(409);
  });

  test('parcours complet jusqu\'à la clôture', async () => {
    const { body } = await declare();

    await moveTo(body.reference, 'EN_INSTRUCTION', 'ACCEPTE', 'INDEMNISE', 'CLOS');
    const res = await backoffice('get', `/api/internal/claims/${body.reference}`);

    expect(res.body.internalStatus).toBe('CLOS');
    expect(res.body.allowedTransitions).toEqual([]);
    expect(res.body.claim.history).toHaveLength(5);
  });
});
