const { parseAmountToCents } = require('../../src/domain/money');

test('convertit un montant entier en centimes', () => {
  expect(parseAmountToCents('1250')).toBe(125000);
});

test('un montant vide donne null', () => {
  expect(parseAmountToCents('')).toBeNull();
});

describe('SF-113 : montants saisis au format français', () => {
  test.each([
    ['1 250,50', 125050],
    ['1250,50', 125050],
    ['19.99', 1999],
    ['19,99', 1999],
    ['0,07', 7],
    ['1 250,50', 125050],
    ['1 250,50', 125050],
    [' 300 ', 30000],
    ['0', 0],
    [1250.5, 125050],
  ])('%p donne %i centimes', (saisie, attendu) => {
    expect(parseAmountToCents(saisie)).toBe(attendu);
  });

  test.each(['abc', '12abc', '-5', '1,2,3', '12,345'])('la saisie %p est refusée', (saisie) => {
    expect(() => parseAmountToCents(saisie)).toThrow('Montant estimé invalide');
  });

  test('un montant absent donne null', () => {
    expect(parseAmountToCents(undefined)).toBeNull();
    expect(parseAmountToCents(null)).toBeNull();
  });
});
