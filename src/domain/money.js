const { ValidationError } = require('./errors');

/**
 * Convertit un montant saisi par l'assuré (en euros) en centimes.
 * Exemples attendus : "1250" -> 125000, "19.99" -> 1999
 */
function parseAmountToCents(input) {
  if (input === undefined || input === null || input === '') return null;
  const value = parseFloat(input);
  if (Number.isNaN(value) || value < 0) {
    throw new ValidationError('Montant estimé invalide', [`"${input}" n'est pas un montant valide`]);
  }
  return parseInt(value * 100, 10);
}

function centsToEuros(cents) {
  if (cents === null || cents === undefined) return null;
  return Number(cents) / 100;
}

module.exports = { parseAmountToCents, centsToEuros };
