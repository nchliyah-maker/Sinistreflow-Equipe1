/**
 * Indemnité versée à l'assuré = montant retenu par l'expert - franchise du contrat.
 * @param {number} assessedAmountCents montant expertisé (centimes)
 * @param {number} franchiseEur franchise du contrat (colonne contracts.franchise_eur)
 * @returns {number} indemnité en centimes
 */
function computeIndemnityCents(assessedAmountCents, franchiseEur) {
  return assessedAmountCents - franchiseEur;
}

module.exports = { computeIndemnityCents };
