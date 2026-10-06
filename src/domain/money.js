const { ValidationError } = require('./errors');

/**
 * Convertit un montant saisi par l'assuré (en euros) en centimes.
 * Exemples attendus : "1250" -> 125000, "19.99" -> 1999, "1 250,50" -> 125050
 */
function parseAmountToCents(input) {
  if (input === undefined || input === null || input === '') return null;
  // Format français : espaces (y compris insécables) pour les milliers, virgule pour les décimales
  const normalized = String(input).replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new ValidationError('Montant estimé invalide', [`"${input}" n'est pas un montant valide`]);
  }
  // Math.round : 19.99 * 100 vaut 1998.9999999999998 en JavaScript
  return Math.round(Number(normalized) * 100);
}

function centsToEuros(cents) {
  if (cents === null || cents === undefined) return null;
  return Number(cents) / 100;
}

module.exports = { parseAmountToCents, centsToEuros };
