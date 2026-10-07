process.env.TZ = 'Europe/Paris';

const {
  app, db, request, partner, backoffice, day, declare, moveTo, cleanup,
} = require('./helpers');

afterAll(cleanup);

/** Crée un dossier auto et l'amène au statut EXPERTISE_EN_COURS. */
async function claimAwaitingAssessment() {
  const { body } = await declare();
  await moveTo(body.reference, 'EN_INSTRUCTION', 'EXPERTISE_EN_COURS');
  return body.reference;
}

const report = (overrides = {}) => ({
  expertName: 'Cabinet ExpertAuto - J. Morel',
  appointmentDate: day(-1),
  assessedAmountCents: 112545,
  conclusion: 'Dommages conformes à la déclaration.',
  ...overrides,
});

describe('API partenaires : authentification', () => {
  test.each(['/api/v1/claims', '/api/v2/claims/SIN-2026-000450', '/api/v3/claims'])(
    '%s sans clé : 401',
    async (url) => {
      const res = await request(app).get(url);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Clé API manquante' });
    },
  );

  test('clé inconnue : 401', async () => {
    const res = await request(app).get('/api/v1/claims').set('X-API-Key', 'ea_live_cle_inconnue');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Clé API invalide' });
  });

  test('l\'en-tête est accepté quelle que soit sa casse', async () => {
    const res = await request(app).get('/api/v1/claims?limit=1').set('x-api-key', process.env.EXPERTAUTO_API_KEY);

    expect(res.status).toBe(200);
  });
});

describe('API partenaires : dossier inconnu', () => {
  test.each(['v1', 'v2', 'v3'])('%s : 404 sans détail technique', async (version) => {
    const res = await partner('get', `/api/${version}/claims/SIN-1999-000000`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Dossier SIN-1999-000000 introuvable');
    expect(res.body).not.toHaveProperty('stack');
  });

  test('v3 : statut de filtre inconnu : 400', async () => {
    const res = await partner('get', '/api/v3/claims?status=ARCHIVED');

    expect(res.status).toBe(400);
  });
});

describe('API v2 : dépôt d\'un rapport d\'expertise', () => {
  test('rapport valide : 201, dossier terminé et indemnité calculée', async () => {
    const reference = await claimAwaitingAssessment();
    const { rows } = await db.query(
      `SELECT ct.franchise_eur FROM claims c JOIN contracts ct ON ct.id = c.contract_id WHERE c.reference = $1`,
      [reference],
    );
    const franchiseCents = Math.round(Number(rows[0].franchise_eur) * 100);

    const res = await partner('post', `/api/v2/claims/${reference}/expertise`).send(report());

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('EXPERTISE_TERMINEE');
    expect(res.body.indemnityCents).toBe(Math.max(112545 - franchiseCents, 0));
    expect(res.body.vehiclePlate).toBe('AB-123-CD');
  });

  test('le rapport se relit à l\'identique en v3, avec le partenaire dans l\'historique', async () => {
    const reference = await claimAwaitingAssessment();
    await partner('post', `/api/v2/claims/${reference}/expertise`).send(report());

    const res = await partner('get', `/api/v3/claims/${reference}`);

    expect(res.body.status).toBe('ASSESSMENT_DONE');
    expect(res.body.expertise).toEqual({
      expert: { name: 'Cabinet ExpertAuto - J. Morel' },
      appointmentDate: day(-1),
      conclusion: 'Dommages conformes à la déclaration.',
    });
    expect(res.body.amounts.assessedCents).toBe(112545);
    const last = res.body.history[res.body.history.length - 1];
    expect(last.to).toBe('ASSESSMENT_DONE');
    expect(last.by).toBe('partenaire:ExpertAuto');
  });

  test('montant expertisé inférieur à la franchise : indemnité à zéro', async () => {
    const reference = await claimAwaitingAssessment();

    const res = await partner('post', `/api/v2/claims/${reference}/expertise`)
      .send(report({ assessedAmountCents: 100 }));

    expect(res.status).toBe(201);
    expect(res.body.indemnityCents).toBe(0);
  });

  test('rapport invalide : 400 avec le détail de chaque erreur', async () => {
    const reference = await claimAwaitingAssessment();

    const res = await partner('post', `/api/v2/claims/${reference}/expertise`)
      .send({ expertName: ' ', appointmentDate: day(2), assessedAmountCents: '112545' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Rapport d\'expertise invalide');
    expect(res.body.details).toEqual([
      'Le nom de l\'expert est obligatoire',
      'La date de rendez-vous d\'expertise ne peut pas être dans le futur',
      'assessedAmountCents doit être un entier positif (centimes)',
    ]);
  });

  test('date de rendez-vous mal formée : 400', async () => {
    const reference = await claimAwaitingAssessment();

    const res = await partner('post', `/api/v2/claims/${reference}/expertise`)
      .send(report({ appointmentDate: '02/10/2026' }));

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(['Date de rendez-vous invalide (format attendu AAAA-MM-JJ)']);
  });

  test('dossier qui n\'attend pas d\'expertise : 409', async () => {
    const { body } = await declare();

    const res = await partner('post', `/api/v2/claims/${body.reference}/expertise`).send(report());

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Transition interdite : DECLARE -> EXPERTISE_TERMINEE');
  });

  test('second dépôt sur le même dossier : 409', async () => {
    const reference = await claimAwaitingAssessment();
    await partner('post', `/api/v2/claims/${reference}/expertise`).send(report());

    const res = await partner('post', `/api/v2/claims/${reference}/expertise`).send(report());

    expect(res.status).toBe(409);
  });
});

describe('API v3 : dépôt d\'un rapport d\'expertise', () => {
  test('rapport au format v3 : 201 et dossier au format v3', async () => {
    const reference = await claimAwaitingAssessment();

    const res = await partner('post', `/api/v3/claims/${reference}/expertise`).send({
      expert: { name: 'Cabinet ExpertAuto - J. Morel' },
      appointmentDate: day(-2),
      assessedCents: 250000,
      conclusion: 'Réparation possible.',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ASSESSMENT_DONE');
    expect(res.body.amounts.assessedCents).toBe(250000);
    expect(res.body.amounts.indemnityCents).toBe(250000 - res.body.contract.deductibleCents);
    expect(res.body.expertise.appointmentDate).toBe(day(-2));
  });

  test('le back-office voit ensuite le dossier terminé', async () => {
    const reference = await claimAwaitingAssessment();
    await partner('post', `/api/v2/claims/${reference}/expertise`).send(report());

    const res = await backoffice('get', `/api/internal/claims/${reference}`);

    expect(res.body.internalStatus).toBe('EXPERTISE_TERMINEE');
    expect(res.body.allowedTransitions).toEqual(['ACCEPTE', 'REFUSE']);
  });
});
