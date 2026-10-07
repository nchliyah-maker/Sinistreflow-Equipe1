process.env.TZ = 'Europe/Paris';

const { parseIsoDate, isFutureDate, daysBetween, formatDate } = require('../../src/domain/dates');
const { parseAmountToCents, centsToEuros } = require('../../src/domain/money');
const { computeIndemnityCents } = require('../../src/domain/indemnity');
const {
  STATUSES, TRANSITIONS, canTransition, assertTransition,
} = require('../../src/domain/workflow');
const {
  ValidationError, UnauthorizedError, NotFoundError, ConflictError,
} = require('../../src/domain/errors');

describe('dates : parseIsoDate', () => {
  test.each([
    ['2026-01-01', 2026, 0, 1],
    ['2026-12-31', 2026, 11, 31],
    ['2024-02-29', 2024, 1, 29], // année bissextile
  ])('%s est lu à minuit, heure locale', (text, year, month, day) => {
    const date = parseIsoDate(text);

    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([year, month, day]);
    expect([date.getHours(), date.getMinutes()]).toEqual([0, 0]);
  });

  test.each([undefined, null, '', 20261005, '05/10/2026', '2026-10-5', '2026-10-05T10:00:00Z'])(
    'saisie invalide : %p donne null',
    (value) => {
      expect(parseIsoDate(value)).toBeNull();
    },
  );
});

describe('dates : isFutureDate', () => {
  const now = new Date(2026, 9, 6, 12, 0, 0);

  test.each([
    ['2026-10-05', false], // hier
    ['2026-10-06', false], // aujourd'hui : minuit est déjà passé
    ['2026-10-07', true], //  demain
    ['2027-01-01', true],
  ])('%s : futur = %p', (text, expected) => {
    expect(isFutureDate(text, now)).toBe(expected);
  });

  test('une date invalide n\'est pas considérée comme future', () => {
    expect(isFutureDate('pas une date', now)).toBe(false);
  });

  test('sans date de référence, on compare à maintenant', () => {
    expect(isFutureDate('2000-01-01')).toBe(false);
    expect(isFutureDate('2999-01-01')).toBe(true);
  });
});

describe('dates : daysBetween et formatDate', () => {
  test.each([
    [new Date(2026, 9, 6), new Date(2026, 9, 6), 0],
    [new Date(2026, 9, 6, 0, 0), new Date(2026, 9, 6, 23, 59), 0], // moins d'un jour plein
    [new Date(2026, 9, 1), new Date(2026, 9, 6), 5],
    [new Date(2026, 1, 28), new Date(2026, 2, 1), 1], //  2026 n'est pas bissextile
    [new Date(2024, 1, 28), new Date(2024, 2, 1), 2], //  2024 l'est
    [new Date(2025, 11, 31), new Date(2026, 0, 1), 1], // changement d'année
  ])('entre %p et %p : %i jour(s)', (from, to, expected) => {
    expect(daysBetween(from, to)).toBe(expected);
  });

  test('formatDate complète le mois et le jour avec un zéro', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  test('formatDate renvoie null sans date', () => {
    expect(formatDate(undefined)).toBeNull();
  });
});

describe('montants', () => {
  test.each([
    [125050, 1250.5],
    ['125050', 1250.5], // valeur lue en texte
    [1999, 19.99],
    [0, 0],
  ])('centsToEuros(%p) = %p', (cents, euros) => {
    expect(centsToEuros(cents)).toBe(euros);
  });

  test('centsToEuros renvoie null sans montant', () => {
    expect(centsToEuros(null)).toBeNull();
    expect(centsToEuros(undefined)).toBeNull();
  });

  test('parseAmountToCents refuse une saisie invalide avec le détail', () => {
    expect.assertions(3);
    try {
      parseAmountToCents('1 250 €');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toBe('Montant estimé invalide');
      expect(err.details).toEqual(['"1 250 €" n\'est pas un montant valide']);
    }
  });

  test('l\'indemnité d\'un gros sinistre reste exacte au centime', () => {
    expect(computeIndemnityCents(1234567, '380.00')).toBe(1196567);
  });
});

describe('workflow', () => {
  test('les 8 statuts ont chacun leurs transitions', () => {
    expect(STATUSES).toHaveLength(8);
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...STATUSES].sort());
  });

  test.each([
    ['DECLARE', 'EN_INSTRUCTION'],
    ['DECLARE', 'REFUSE'],
    ['EN_INSTRUCTION', 'EXPERTISE_EN_COURS'],
    ['EN_INSTRUCTION', 'ACCEPTE'], // accord direct sans expertise
    ['EN_INSTRUCTION', 'REFUSE'],
    ['EXPERTISE_EN_COURS', 'EXPERTISE_TERMINEE'],
    ['EXPERTISE_TERMINEE', 'ACCEPTE'],
    ['EXPERTISE_TERMINEE', 'REFUSE'],
    ['ACCEPTE', 'INDEMNISE'],
    ['INDEMNISE', 'CLOS'],
    ['REFUSE', 'CLOS'],
  ])('%s -> %s est autorisée', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  test.each([
    ['DECLARE', 'INDEMNISE'],
    ['DECLARE', 'EXPERTISE_EN_COURS'],
    ['EXPERTISE_EN_COURS', 'ACCEPTE'],
    ['EXPERTISE_TERMINEE', 'INDEMNISE'],
    ['REFUSE', 'ACCEPTE'],
    ['INDEMNISE', 'ACCEPTE'],
    ['CLOS', 'DECLARE'],
    ['ACCEPTE', 'ACCEPTE'],
  ])('%s -> %s est interdite (409)', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(ConflictError);
    expect(() => assertTransition(from, to)).toThrow(`Transition interdite : ${from} -> ${to}`);
  });

  test('un statut inconnu est refusé', () => {
    expect(() => assertTransition('DECLARE', 'ARCHIVE')).toThrow('Statut inconnu : ARCHIVE');
    expect(canTransition('ARCHIVE', 'CLOS')).toBe(false);
  });
});

describe('erreurs métier', () => {
  test.each([
    [new ValidationError('saisie invalide', ['champ a']), 'ValidationError', 400, 'saisie invalide'],
    [new UnauthorizedError(), 'UnauthorizedError', 401, 'Non authentifié'],
    [new UnauthorizedError('Clé API invalide'), 'UnauthorizedError', 401, 'Clé API invalide'],
    [new NotFoundError(), 'NotFoundError', 404, 'Ressource introuvable'],
    [new NotFoundError('Dossier introuvable'), 'NotFoundError', 404, 'Dossier introuvable'],
    [new ConflictError('Transition interdite'), 'ConflictError', 409, 'Transition interdite'],
  ])('%s porte son code HTTP', (err, name, status, message) => {
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe(name);
    expect(err.status).toBe(status);
    expect(err.message).toBe(message);
  });

  test('une ValidationError garde le détail des erreurs, vide par défaut', () => {
    expect(new ValidationError('x', ['a', 'b']).details).toEqual(['a', 'b']);
    expect(new ValidationError('x').details).toEqual([]);
  });
});
