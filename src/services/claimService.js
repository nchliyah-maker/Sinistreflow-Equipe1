const claimRepository = require('../repositories/claimRepository');
const contractRepository = require('../repositories/contractRepository');
const { validateDeclaration, TYPES_BY_PRODUCT } = require('../domain/claimRules');
const { assertTransition } = require('../domain/workflow');
const { computeIndemnityCents } = require('../domain/indemnity');
const { parseIsoDate, isFutureDate } = require('../domain/dates');
const { ValidationError, NotFoundError } = require('../domain/errors');
const metrics = require('../metrics');

async function verifyContract(contractNumber, email) {
  const contract = await contractRepository.findByNumberAndEmail(contractNumber, email);
  if (!contract) {
    throw new NotFoundError('Aucun contrat ne correspond à ce numéro et à cet email');
  }
  return contract;
}

async function getAllowedTypes(contract) {
  return TYPES_BY_PRODUCT[contract.product] || [];
}

async function declare(payload) {
  const contract = await verifyContract(payload.contractNumber, payload.email);
  const claim = validateDeclaration(payload, contract);
  const reference = await claimRepository.create(claim);
  metrics.claimsDeclared.inc({ type: claim.type });
  return claimRepository.findByReference(reference);
}

async function getClaim(reference) {
  const claim = await claimRepository.findByReference(reference);
  if (!claim) throw new NotFoundError(`Dossier ${reference} introuvable`);
  return claim;
}

async function getDetailedClaim(reference) {
  const claim = await claimRepository.findDetailedByReference(reference);
  if (!claim) throw new NotFoundError(`Dossier ${reference} introuvable`);
  return claim;
}

/**
 * Enregistre le rapport d'un expert (partenaire) et calcule l'indemnité.
 * Le dossier passe en EXPERTISE_TERMINEE.
 */
async function recordExpertise(reference, expertise, changedBy) {
  const claim = await getClaim(reference);
  assertTransition(claim.status, 'EXPERTISE_TERMINEE');

  const errors = [];
  if (!expertise.expertName || !String(expertise.expertName).trim()) {
    errors.push("Le nom de l'expert est obligatoire");
  }
  if (!parseIsoDate(expertise.appointmentDate)) {
    errors.push('Date de rendez-vous invalide (format attendu AAAA-MM-JJ)');
  } else if (isFutureDate(expertise.appointmentDate)) {
    errors.push("La date de rendez-vous d'expertise ne peut pas être dans le futur");
  }
  if (!Number.isInteger(expertise.assessedAmountCents) || expertise.assessedAmountCents < 0) {
    errors.push('assessedAmountCents doit être un entier positif (centimes)');
  }
  if (errors.length > 0) throw new ValidationError("Rapport d'expertise invalide", errors);

  const indemnityCents = computeIndemnityCents(expertise.assessedAmountCents, claim.franchise_eur);
  await claimRepository.saveExpertise(claim, expertise, indemnityCents, changedBy);
  metrics.expertisesSubmitted.inc({ partner: changedBy.replace(/^partenaire:/, '') });
  return getClaim(reference);
}

async function changeStatus(reference, toStatus, changedBy) {
  const claim = await getClaim(reference);
  assertTransition(claim.status, toStatus);
  await claimRepository.updateStatus(claim, toStatus, changedBy);
  return getDetailedClaim(reference);
}

module.exports = {
  verifyContract,
  getAllowedTypes,
  declare,
  getClaim,
  getDetailedClaim,
  recordExpertise,
  changeStatus,
};
