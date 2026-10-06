process.env.TZ = 'Europe/Paris';

const {
  TYPES_BY_PRODUCT,
  THEFT_TYPES,
  DECLARATION_DELAY_DAYS,
  isLateDeclaration,
  validateDeclaration,
} = require('../../src/domain/claimRules');
const { ValidationError } = require('../../src/domain/errors');

// "Aujourd'hui" fixe pour tous les tests : mardi 6 octobre 2026 à midi
const NOW = new Date(2026, 9, 6, 12, 0, 0);

const AUTO = { id: 1, contract_number: 'MA-AUTO-001001', product: 'AUTO', status: 'ACTIF' };
const HOME = { id: 2, contract_number: 'MA-HAB-002001', product: 'HABITATION', status: 'ACTIF' };

const autoClaim = (overrides = {}) => ({
  type: 'AUTO_COLLISION',
  incidentDate: '2026-10-05',
  incidentLocation: '  rue Victor Hugo, Grenoble  ',
  description: 'Collision au carrefour avec un autre véhicule.',
  vehicle: { plate: 'ab-123-cd', brand: ' Renault ', model: ' Clio ' },
  estimatedAmount: '1 250,50',
  ...overrides,
});

const homeClaim = (overrides = {}) => ({
  type: 'DEGAT_DES_EAUX',
  incidentDate: '2026-10-05',
  description: 'Fuite sous l\'évier, parquet de la cuisine abîmé.',
  estimatedAmount: '300',
  ...overrides,
});

/** Lance la validation et renvoie la liste des erreurs (vide si la déclaration est valide). */
function errorsOf(input, contract) {
  try {
    validateDeclaration(input, contract, NOW);
    return [];
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe('Déclaration invalide');
    return err.details;
  }
}

describe('règles de déclaration : constantes', () => {
  test('chaque produit a ses types de sinistre', () => {
    expect(TYPES_BY_PRODUCT.AUTO).toEqual(['AUTO_COLLISION', 'AUTO_VOL', 'BRIS_DE_GLACE']);
    expect(TYPES_BY_PRODUCT.HABITATION).toEqual(['DEGAT_DES_EAUX', 'INCENDIE', 'CAMBRIOLAGE']);
  });

  test('les vols sont le vol de véhicule et le cambriolage', () => {
    expect(THEFT_TYPES).toEqual(['AUTO_VOL', 'CAMBRIOLAGE']);
  });

  test('délais : 2 jours pour un vol, 5 jours sinon', () => {
    expect(DECLARATION_DELAY_DAYS).toEqual({ THEFT: 2, DEFAULT: 5 });
  });
});

describe('isLateDeclaration', () => {
  test.each([
    ['DEGAT_DES_EAUX', '2026-10-06', false], // le jour même
    ['DEGAT_DES_EAUX', '2026-10-01', false], // J+5 : dernier jour du délai
    ['DEGAT_DES_EAUX', '2026-09-30', true], //  J+6 : tardif
    ['AUTO_COLLISION', '2026-10-01', false],
    ['AUTO_VOL', '2026-10-04', false], //       J+2 : dernier jour pour un vol
    ['AUTO_VOL', '2026-10-03', true], //        J+3 : tardif
    ['CAMBRIOLAGE', '2026-10-04', false],
    ['CAMBRIOLAGE', '2026-10-03', true],
  ])('%s survenu le %s : tardif = %p', (type, incidentDate, expected) => {
    expect(isLateDeclaration(type, incidentDate, NOW)).toBe(expected);
  });

  test('sans date de déclaration fournie, on compare à maintenant', () => {
    expect(isLateDeclaration('DEGAT_DES_EAUX', '2020-01-01')).toBe(true);
  });
});

describe('validateDeclaration : déclaration valide', () => {
  test('sinistre auto : les champs sont nettoyés et normalisés', () => {
    const claim = validateDeclaration(autoClaim(), AUTO, NOW);

    expect(claim).toEqual({
      contractId: 1,
      type: 'AUTO_COLLISION',
      incidentDate: '2026-10-05',
      incidentLocation: 'rue Victor Hugo, Grenoble',
      description: 'Collision au carrefour avec un autre véhicule.',
      complaintNumber: null,
      thirdParty: { involved: false, name: null, insurer: null },
      vehicle: { plate: 'AB-123-CD', brand: 'Renault', model: 'Clio' },
      estimatedAmountCents: 125050,
      lateDeclaration: false,
    });
  });

  test('sinistre habitation : pas de véhicule, lieu facultatif', () => {
    const claim = validateDeclaration(homeClaim(), HOME, NOW);

    expect(claim.vehicle).toBeNull();
    expect(claim.incidentLocation).toBeNull();
    expect(claim.estimatedAmountCents).toBe(30000);
  });

  test('véhicule sans marque ni modèle : seuls la plaque est obligatoire', () => {
    const claim = validateDeclaration(autoClaim({ vehicle: { plate: 'AB-123-CD' } }), AUTO, NOW);

    expect(claim.vehicle).toEqual({ plate: 'AB-123-CD', brand: null, model: null });
  });

  test('montant estimé absent : accepté et enregistré à null', () => {
    const claim = validateDeclaration(homeClaim({ estimatedAmount: '' }), HOME, NOW);

    expect(claim.estimatedAmountCents).toBeNull();
  });

  test('cambriolage avec numéro de plainte', () => {
    const claim = validateDeclaration(
      homeClaim({ type: 'CAMBRIOLAGE', complaintNumber: ' PV-2026-01234 ' }),
      HOME,
      NOW,
    );

    expect(claim.complaintNumber).toBe('PV-2026-01234');
  });

  test('tiers impliqué : nom et assureur nettoyés', () => {
    const claim = validateDeclaration(
      autoClaim({ thirdParty: { involved: true, name: ' Jean Martin ', insurer: ' MAAF ' } }),
      AUTO,
      NOW,
    );

    expect(claim.thirdParty).toEqual({ involved: true, name: 'Jean Martin', insurer: 'MAAF' });
  });

  test('tiers impliqué sans assureur connu', () => {
    const claim = validateDeclaration(
      autoClaim({ thirdParty: { involved: true, name: 'Jean Martin' } }),
      AUTO,
      NOW,
    );

    expect(claim.thirdParty.insurer).toBeNull();
  });

  test('déclaration au-delà du délai : acceptée mais marquée tardive', () => {
    const claim = validateDeclaration(homeClaim({ incidentDate: '2026-09-01' }), HOME, NOW);

    expect(claim.lateDeclaration).toBe(true);
  });

  test('sans date fournie, la validation utilise la date du jour', () => {
    const claim = validateDeclaration(homeClaim({ incidentDate: '2020-01-01' }), HOME);

    expect(claim.lateDeclaration).toBe(true);
  });
});

describe('validateDeclaration : déclaration refusée', () => {
  test('contrat résilié', () => {
    const errors = errorsOf(autoClaim(), { ...AUTO, status: 'RESILIE' });

    expect(errors).toEqual(['Le contrat MA-AUTO-001001 n\'est pas actif']);
  });

  test('type de sinistre non couvert par le produit', () => {
    const errors = errorsOf(homeClaim({ type: 'AUTO_COLLISION' }), HOME);

    expect(errors).toEqual(['Type de sinistre "AUTO_COLLISION" non couvert par un contrat HABITATION']);
  });

  test('produit inconnu : aucun type n\'est couvert', () => {
    const errors = errorsOf(homeClaim(), { ...HOME, product: 'SANTE' });

    expect(errors).toEqual(['Type de sinistre "DEGAT_DES_EAUX" non couvert par un contrat SANTE']);
  });

  test.each(['', 'hier', '05/10/2026', '2026-13-45x', undefined])('date invalide : %p', (incidentDate) => {
    const errors = errorsOf(homeClaim({ incidentDate }), HOME);

    expect(errors).toContain('Date du sinistre invalide (format attendu AAAA-MM-JJ)');
  });

  test('date dans le futur', () => {
    const errors = errorsOf(homeClaim({ incidentDate: '2026-10-07' }), HOME);

    expect(errors).toEqual(['La date du sinistre ne peut pas être dans le futur']);
  });

  test.each(['', '   ', 'trop court', undefined])('description de moins de 20 caractères : %p', (description) => {
    const errors = errorsOf(homeClaim({ description }), HOME);

    expect(errors).toEqual(['La description doit faire au moins 20 caractères']);
  });

  test.each([
    [undefined],
    [{}],
    [{ plate: '' }],
    [{ plate: '1234-AB-38' }],
    [{ plate: 'ABC-123-D' }],
  ])('immatriculation invalide pour un contrat auto : %p', (vehicle) => {
    const errors = errorsOf(autoClaim({ vehicle }), AUTO);

    expect(errors).toEqual(['Immatriculation invalide (format AA-123-AA)']);
  });

  test.each(['AUTO_VOL', 'CAMBRIOLAGE'])('%s sans numéro de plainte', (type) => {
    const contract = type === 'AUTO_VOL' ? AUTO : HOME;
    const input = type === 'AUTO_VOL' ? autoClaim({ type }) : homeClaim({ type, complaintNumber: '   ' });

    expect(errorsOf(input, contract)).toEqual(['Le numéro de dépôt de plainte est obligatoire pour un vol']);
  });

  test('tiers impliqué sans nom', () => {
    const errors = errorsOf(autoClaim({ thirdParty: { involved: true, name: '  ' } }), AUTO);

    expect(errors).toEqual(['Le nom du tiers impliqué est obligatoire']);
  });

  test('montant estimé invalide', () => {
    const errors = errorsOf(homeClaim({ estimatedAmount: 'beaucoup' }), HOME);

    expect(errors).toEqual(['"beaucoup" n\'est pas un montant valide']);
  });

  test('toutes les erreurs sont remontées en une seule fois', () => {
    const errors = errorsOf(
      { type: 'INCENDIE', incidentDate: 'x', description: 'court', estimatedAmount: '-1' },
      { ...AUTO, status: 'SUSPENDU' },
    );

    expect(errors).toHaveLength(6);
  });
});
