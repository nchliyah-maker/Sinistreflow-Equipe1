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
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/** Formate une date (colonne SQL DATE) en "AAAA-MM-JJ" pour l'API. */
function formatDate(date) {
  if (!date) return null;
  // Une colonne DATE est lue à minuit heure locale : toISOString() la convertirait
  // en UTC et renverrait la veille. On lit donc l'année, le mois et le jour locaux.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = { parseIsoDate, isFutureDate, daysBetween, formatDate };
