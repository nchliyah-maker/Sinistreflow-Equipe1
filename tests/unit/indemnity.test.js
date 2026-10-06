const { computeIndemnityCents } = require('../../src/domain/indemnity');

describe('SF-106 : calcul de l\'indemnité', () => {
  test('la franchise (en euros) est déduite en centimes', () => {
    // 1 000 € expertisés - 150 € de franchise = 850 €
    expect(computeIndemnityCents(100000, 150)).toBe(85000);
  });

  test('la franchise lue en base (texte "150.00") est comprise', () => {
    expect(computeIndemnityCents(100000, '150.00')).toBe(85000);
  });

  test('une franchise avec des centimes est déduite au centime près', () => {
    expect(computeIndemnityCents(100000, '99.99')).toBe(90001);
  });

  test('l\'indemnité n\'est jamais négative quand la franchise dépasse le montant', () => {
    // bris de glace à 120 € avec 150 € de franchise
    expect(computeIndemnityCents(12000, 150)).toBe(0);
  });

  test('montant égal à la franchise : indemnité nulle', () => {
    expect(computeIndemnityCents(15000, 150)).toBe(0);
  });

  test('sans franchise, tout le montant expertisé est versé', () => {
    expect(computeIndemnityCents(12000, 0)).toBe(12000);
  });
});
