const db = require('../../src/db/pool');
const claimRepository = require('../../src/repositories/claimRepository');

const created = [];

afterAll(async () => {
  await db.query('DELETE FROM claims WHERE reference = ANY($1)', [created]);
  await db.pool.end();
});

function newClaim() {
  return {
    contractId: 2,
    type: 'DEGAT_DES_EAUX',
    incidentDate: '2026-10-01',
    incidentLocation: 'Grenoble',
    description: 'Fuite sous évier, test de la référence de dossier',
    complaintNumber: null,
    thirdParty: { involved: false, name: null, insurer: null },
    estimatedAmountCents: 50000,
    lateDeclaration: false,
    vehicle: null,
  };
}

describe('SF-104 : référence des nouveaux dossiers', () => {
  test('un dossier peut être créé sur la base de production', async () => {
    const reference = await claimRepository.create(newClaim());
    created.push(reference);

    expect(reference).toMatch(/^SIN-\d{4}-\d{6}$/);
  });

  test('deux dossiers créés à la suite ont des numéros qui se suivent', async () => {
    const first = await claimRepository.create(newClaim());
    created.push(first);
    const second = await claimRepository.create(newClaim());
    created.push(second);

    const number = (reference) => parseInt(reference.split('-')[2], 10);
    expect(number(second)).toBe(number(first) + 1);
  });
});
