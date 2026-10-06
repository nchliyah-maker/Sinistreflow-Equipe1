const { parseIsoDate, daysBetween } = require('../../src/domain/dates');
const { isLateDeclaration } = require('../../src/domain/claimRules');

describe('SF-102 : parseIsoDate', () => {
  test('le 5 octobre 2026 reste en octobre', () => {
    const date = parseIsoDate('2026-10-05');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(5);
  });
});

describe('SF-103 : délai de déclaration', () => {
  test('il y a 1 jour entre le 4 et le 5 octobre', () => {
    expect(daysBetween(new Date(2026, 9, 4), new Date(2026, 9, 5))).toBe(1);
  });

  test('un dégât des eaux déclaré le lendemain n\'est pas tardif', () => {
    expect(isLateDeclaration('DEGAT_DES_EAUX', '2026-10-04', new Date(2026, 9, 5))).toBe(false);
  });

  test('un dégât des eaux est tardif à partir de 6 jours', () => {
    expect(isLateDeclaration('DEGAT_DES_EAUX', '2026-10-01', new Date(2026, 9, 6))).toBe(false);
    expect(isLateDeclaration('DEGAT_DES_EAUX', '2026-10-01', new Date(2026, 9, 7))).toBe(true);
  });

  test('un vol est tardif à partir de 3 jours', () => {
    expect(isLateDeclaration('AUTO_VOL', '2026-10-01', new Date(2026, 9, 3))).toBe(false);
    expect(isLateDeclaration('AUTO_VOL', '2026-10-01', new Date(2026, 9, 4))).toBe(true);
  });
});
