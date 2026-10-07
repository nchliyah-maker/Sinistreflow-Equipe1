process.env.TZ = 'Europe/Paris';

const {
  app, db, request, day, declare, cleanup,
} = require('./helpers');

afterAll(cleanup);

describe('API publique : identification de l\'assuré', () => {
  test('contrat actif : produit, titulaire, franchise et types autorisés', async () => {
    const res = await request(app).post('/api/public/contracts/verify')
      .send({ contractNumber: 'ma-auto-001001', email: 'camille.durand@example.test' });

    expect(res.status).toBe(200);
    expect(res.body.contractNumber).toBe('MA-AUTO-001001');
    expect(res.body.product).toBe('AUTO');
    expect(res.body.holder).toEqual({ firstName: 'Camille', lastName: 'Durand' });
    expect(res.body.allowedTypes).toEqual(['AUTO_COLLISION', 'AUTO_VOL', 'BRIS_DE_GLACE']);
  });

  test.each([
    [{}],
    [{ contractNumber: 'MA-AUTO-001001' }],
    [{ email: 'camille.durand@example.test' }],
  ])('champs manquants %p : 400', async (body) => {
    const res = await request(app).post('/api/public/contracts/verify').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Numéro de contrat et email obligatoires');
  });

  test('contrat inconnu : 404', async () => {
    const res = await request(app).post('/api/public/contracts/verify')
      .send({ contractNumber: 'MA-AUTO-999999', email: 'camille.durand@example.test' });

    expect(res.status).toBe(404);
  });

  test('contrat suspendu : 400', async () => {
    const res = await request(app).post('/api/public/contracts/verify')
      .send({ contractNumber: 'MA-HAB-002003', email: 'theo.garnier@example.test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Le contrat MA-HAB-002003 n\'est plus actif');
  });
});

describe('API publique : envoi d\'une déclaration', () => {
  test('déclaration auto complète : 201 et dossier enregistré', async () => {
    const res = await declare();

    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^SIN-\d{4}-\d{6}$/);
    expect(res.body.status).toBe('DECLARE');
    expect(res.body.type).toBe('AUTO_COLLISION');
    expect(res.body.incidentDate).toBe(day(-1));
    expect(res.body.estimatedAmountCents).toBe(125050);
    expect(res.body.lateDeclaration).toBe(false);
  });

  test('le véhicule et l\'historique sont écrits en base', async () => {
    const res = await declare();
    const { rows } = await db.query(
      `SELECT v.plate_number, v.brand, c.immatriculation,
              (SELECT count(*) FROM claim_status_history h WHERE h.claim_id = c.id) AS history
       FROM claims c JOIN vehicles v ON v.claim_id = c.id WHERE c.reference = $1`,
      [res.body.reference],
    );

    expect(rows[0].plate_number).toBe('AB-123-CD');
    expect(rows[0].brand).toBe('Renault');
    expect(rows[0].immatriculation).toBeNull(); // colonne obsolète, plus alimentée
    expect(rows[0].history).toBe(1);
  });

  test('déclaration au-delà de 5 jours : acceptée mais marquée tardive', async () => {
    const res = await declare({ incidentDate: day(-10) });

    expect(res.status).toBe(201);
    expect(res.body.lateDeclaration).toBe(true);
  });

  test('déclaration invalide : 400 avec le détail, sans stack trace', async () => {
    const res = await declare({ incidentDate: day(1), description: 'court', vehicle: { plate: 'X' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Déclaration invalide');
    expect(res.body.details).toEqual([
      'La date du sinistre ne peut pas être dans le futur',
      'La description doit faire au moins 20 caractères',
      'Immatriculation invalide (format AA-123-AA)',
    ]);
    expect(res.body).not.toHaveProperty('stack');
  });

  test('vol sans numéro de plainte : 400', async () => {
    const res = await declare({ type: 'AUTO_VOL' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(['Le numéro de dépôt de plainte est obligatoire pour un vol']);
  });

  test('email qui n\'est pas celui du contrat : 404, rien n\'est créé', async () => {
    const before = await db.query('SELECT count(*) AS n FROM claims');
    const res = await declare({ email: 'quelqu.un.dautre@example.test' });
    const after = await db.query('SELECT count(*) AS n FROM claims');

    expect(res.status).toBe(404);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  test('route inconnue : 404 en JSON', async () => {
    const res = await request(app).get('/api/public/nexiste-pas');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Route inconnue');
  });
});
