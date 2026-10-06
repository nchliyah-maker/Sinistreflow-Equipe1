// Tests écrits par l'ancienne équipe (2022) - lancés à la main de temps en temps
const { canTransition, assertTransition } = require('../../src/domain/workflow');

describe('workflow des dossiers', () => {
  test('un dossier déclaré peut passer en instruction', () => {
    expect(canTransition('DECLARE', 'EN_INSTRUCTION')).toBe(true);
  });

  test('SF-105 : un dossier refusé ne peut pas être indemnisé', () => {
    expect(canTransition('REFUSE', 'INDEMNISE')).toBe(false);
    expect(() => assertTransition('REFUSE', 'INDEMNISE')).toThrow('Transition interdite');
  });

  test('SF-105 : un dossier refusé peut seulement être clos', () => {
    expect(canTransition('REFUSE', 'CLOS')).toBe(true);
  });

  test('SF-105 : seul un dossier accepté peut être indemnisé', () => {
    expect(canTransition('ACCEPTE', 'INDEMNISE')).toBe(true);
  });

  test('un dossier clos ne bouge plus', () => {
    expect(() => assertTransition('CLOS', 'EN_INSTRUCTION')).toThrow('Transition interdite');
  });
});
