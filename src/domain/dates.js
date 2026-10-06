const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convertit une date saisie "AAAA-MM-JJ" en objet Date (minuit, heure locale).
 * Retourne null si la chaîne n'est pas une date valide.
 */
function parseIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isFutureDate(value, now = new Date()) {
  const date = parseIsoDate(value);
  return date !== null && date > now;
}

/** Nombre de jours pleins entre deux dates. */
function daysBetween(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60));
}

/** Formate une date (colonne SQL DATE) en "AAAA-MM-JJ" pour l'API. */
function formatDate(date) {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

module.exports = { parseIsoDate, isFutureDate, daysBetween, formatDate };
