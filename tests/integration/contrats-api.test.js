process.env.TZ = 'Europe/Paris';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db/pool');

afterAll(() => db.pool.end());

const get = (url) => request(app).get(url).set('X-API-Key', process.env.EXPERTAUTO_API_KEY);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PLATE = /^[A-Z]{2}-\d{3}-[A-Z]{2}$/;

// Dossier récent (déclaré après la migration 8) : plaque uniquement dans la table vehicles
const RECENT = 'SIN-2026-000450';
// Dossier ancien : plaque présente dans l'ancienne colonne claims.immatriculation
const OLD = 'SIN-2025-000304';
// Dossier récent déjà expertisé : tous les montants sont renseignés
const ASSESSED = 'SIN-2026-000452';
// Dossier habitation : pas de véhicule
const NO_VEHICLE = 'SIN-2026-000457';

describe('SF-109 : immatriculation dans les API v1 et v2', () => {
  test('v1 : un dossier récent a son immatriculation', async () => {
    const res = await get(`/api/v1/claims/${RECENT}`);

    expect(res.status).toBe(200);
    expect(res.body.immatriculation).toBe('LA-211-UA');
  });

  test('v2 : un dossier récent a son vehiclePlate', async () => {
    const res = await get(`/api/v2/claims/${RECENT}`);

    expect(res.status).toBe(200);
    expect(res.body.vehiclePlate).toBe('LA-211-UA');
  });

  test('v1 et v2 : un dossier ancien garde son immatriculation', async () => {
    const v1 = await get(`/api/v1/claims/${OLD}`);
    const v2 = await get(`/api/v2/claims/${OLD}`);

    expect(v1.body.immatriculation).toBe('MT-614-XH');
    expect(v2.body.vehiclePlate).toBe('MT-614-XH');
  });

  test('v1 et v2 : un dossier sans véhicule renvoie null', async () => {
    const v1 = await get(`/api/v1/claims/${NO_VEHICLE}`);
    const v2 = await get(`/api/v2/claims/${NO_VEHICLE}`);

    expect(v1.body.immatriculation).toBeNull();
    expect(v2.body.vehiclePlate).toBeNull();
  });

  test('v1 : dans la liste, tous les dossiers auto ont une immatriculation', async () => {
    const res = await get('/api/v1/claims?statut=EXPERTISE_EN_COURS&page=1&limit=50');
    const autos = res.body.data.filter((claim) => claim.type_sinistre.startsWith('AUTO')
      || claim.type_sinistre === 'BRIS_DE_GLACE');

    expect(autos.length).toBeGreaterThan(0);
    autos.forEach((claim) => expect(claim.immatriculation).toMatch(PLATE));
  });
});

describe('contrat de l\'API v1', () => {
  test('détail : liste exacte des champs et types', async () => {
    const res = await get(`/api/v1/claims/${ASSESSED}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'date_sinistre', 'description', 'id', 'immatriculation', 'montant_estime',
      'numero_contrat', 'reference', 'statut', 'type_sinistre',
    ]);
    expect(typeof res.body.id).toBe('number');
    expect(res.body.reference).toBe(ASSESSED);
    expect(typeof res.body.numero_contrat).toBe('string');
    expect(typeof res.body.type_sinistre).toBe('string');
    expect(res.body.date_sinistre).toMatch(ISO_DATE);
    expect(res.body.statut).toBe('EXPERTISE_TERMINEE');
    expect(typeof res.body.description).toBe('string');
    expect(typeof res.body.montant_estime).toBe('number');
    expect(res.body.immatriculation).toMatch(PLATE);
  });

  test('liste : enveloppe data / page / limit / total', async () => {
    const res = await get('/api/v1/claims?page=1&limit=5');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['data', 'limit', 'page', 'total']);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
    expect(Number.isInteger(res.body.total)).toBe(true);
  });
});

describe('contrat de l\'API v2', () => {
  test('détail : liste exacte des champs et types', async () => {
    const res = await get(`/api/v2/claims/${ASSESSED}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'contractNumber', 'description', 'estimatedAmountCents', 'incidentDate', 'incidentLocation',
      'indemnityCents', 'lateDeclaration', 'reference', 'status', 'thirdParty', 'type', 'vehiclePlate',
    ]);
    expect(res.body.reference).toBe(ASSESSED);
    expect(typeof res.body.contractNumber).toBe('string');
    expect(typeof res.body.type).toBe('string');
    expect(res.body.incidentDate).toMatch(ISO_DATE);
    expect(res.body.status).toBe('EXPERTISE_TERMINEE');
    expect(typeof res.body.description).toBe('string');
    expect(Number.isInteger(res.body.estimatedAmountCents)).toBe(true);
    expect(Number.isInteger(res.body.indemnityCents)).toBe(true);
    expect(res.body.vehiclePlate).toMatch(PLATE);
    expect(typeof res.body.lateDeclaration).toBe('boolean');
    expect(Object.keys(res.body.thirdParty).sort()).toEqual(['insurer', 'involved', 'name']);
    expect(typeof res.body.thirdParty.involved).toBe('boolean');
  });
});

describe('contrat de l\'API v3', () => {
  test('détail : liste exacte des champs et types', async () => {
    const res = await get(`/api/v3/claims/${ASSESSED}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'amounts', 'contract', 'declaredAt', 'expertise', 'history', 'incident',
      'lateDeclaration', 'reference', 'status', 'thirdParty', 'vehicle',
    ]);
    expect(res.body.reference).toBe(ASSESSED);
    expect(res.body.status).toBe('ASSESSMENT_DONE');
    expect(Number.isNaN(Date.parse(res.body.declaredAt))).toBe(false);
    expect(typeof res.body.lateDeclaration).toBe('boolean');
    expect(Object.keys(res.body.contract).sort()).toEqual(['deductibleCents', 'number', 'product']);
    expect(Number.isInteger(res.body.contract.deductibleCents)).toBe(true);
    expect(Object.keys(res.body.incident).sort()).toEqual([
      'complaintNumber', 'date', 'description', 'location', 'type',
    ]);
    expect(res.body.incident.date).toMatch(ISO_DATE);
    expect(Object.keys(res.body.vehicle).sort()).toEqual(['brand', 'model', 'plate']);
    expect(res.body.vehicle.plate).toMatch(PLATE);
    expect(Object.keys(res.body.thirdParty).sort()).toEqual(['insurer', 'involved', 'name']);
    expect(Object.keys(res.body.amounts).sort()).toEqual(['assessedCents', 'estimatedCents', 'indemnityCents']);
    expect(Number.isInteger(res.body.amounts.estimatedCents)).toBe(true);
    expect(Number.isInteger(res.body.amounts.assessedCents)).toBe(true);
    expect(Number.isInteger(res.body.amounts.indemnityCents)).toBe(true);
    expect(Object.keys(res.body.expertise).sort()).toEqual(['appointmentDate', 'conclusion', 'expert']);
    expect(res.body.expertise.appointmentDate).toMatch(ISO_DATE);
    expect(Array.isArray(res.body.history)).toBe(true);
    expect(Object.keys(res.body.history[0]).sort()).toEqual(['at', 'by', 'from', 'to']);
  });

  test('liste : enveloppe items / pagination', async () => {
    const res = await get('/api/v3/claims?status=ASSESSMENT_PENDING&page=1&limit=5');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['items', 'pagination']);
    expect(Object.keys(res.body.pagination).sort()).toEqual(['limit', 'page', 'total']);
    expect(Object.keys(res.body.items[0]).sort()).toEqual([
      'contract', 'declaredAt', 'incident', 'reference', 'status',
    ]);
    res.body.items.forEach((item) => expect(item.status).toBe('ASSESSMENT_PENDING'));
  });
});

describe('cohérence entre les versions servies', () => {
  test.each([RECENT, OLD, ASSESSED])('%s est décrit de la même façon en v1, v2 et v3', async (reference) => {
    const v1 = (await get(`/api/v1/claims/${reference}`)).body;
    const v2 = (await get(`/api/v2/claims/${reference}`)).body;
    const v3 = (await get(`/api/v3/claims/${reference}`)).body;

    // plaque
    expect(v1.immatriculation).toMatch(PLATE);
    expect(v2.vehiclePlate).toBe(v1.immatriculation);
    expect(v3.vehicle.plate).toBe(v1.immatriculation);

    // date du sinistre
    expect(v2.incidentDate).toBe(v1.date_sinistre);
    expect(v3.incident.date).toBe(v1.date_sinistre);

    // montants : euros en v1, centimes en v2 et v3
    expect(Math.round(v1.montant_estime * 100)).toBe(v2.estimatedAmountCents);
    expect(v3.amounts.estimatedCents).toBe(v2.estimatedAmountCents);
    expect(v3.amounts.indemnityCents).toBe(v2.indemnityCents);

    // contrat et type
    expect(v2.contractNumber).toBe(v1.numero_contrat);
    expect(v3.contract.number).toBe(v1.numero_contrat);
    expect(v2.type).toBe(v1.type_sinistre);
    expect(v3.incident.type).toBe(v1.type_sinistre);
  });
});
