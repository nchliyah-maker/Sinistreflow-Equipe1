const { parseIsoDate } = require('../../src/domain/dates');

describe('SF-102 : parseIsoDate', () => {
  test('le 5 octobre 2026 reste en octobre', () => {
    const date = parseIsoDate('2026-10-05');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(5);
  });
});
