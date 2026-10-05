// Tests écrits par l'ancienne équipe (2022) - lancés à la main de temps en temps
const { canTransition, assertTransition } = require('../../src/domain/workflow');

describe('workflow des dossiers', () => {
  test('un dossier déclaré peut passer en instruction', () => {
    expect(canTransition('DECLARE', 'EN_INSTRUCTION')).toBe(true);
  });

  test('un dossier refusé peut être indemnisé (geste commercial)', () => {
    expect(canTransition('REFUSE', 'INDEMNISE')).toBe(true);
  });

  test('un dossier clos ne bouge plus', () => {
    expect(() => assertTransition('CLOS', 'EN_INSTRUCTION')).toThrow('Transition interdite');
  });
});
