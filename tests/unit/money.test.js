const { parseAmountToCents } = require('../../src/domain/money');

test('convertit un montant entier en centimes', () => {
  expect(parseAmountToCents('1250')).toBe(125000);
});

test('un montant vide donne null', () => {
  expect(parseAmountToCents('')).toBeNull();
});
