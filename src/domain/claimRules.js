const { ValidationError } = require('./errors');
const { parseIsoDate, isFutureDate, daysBetween } = require('./dates');
const { parseAmountToCents } = require('./money');

const TYPES_BY_PRODUCT = {
  AUTO: ['AUTO_COLLISION', 'AUTO_VOL', 'BRIS_DE_GLACE'],
  HABITATION: ['DEGAT_DES_EAUX', 'INCENDIE', 'CAMBRIOLAGE'],
};

const THEFT_TYPES = ['AUTO_VOL', 'CAMBRIOLAGE'];

// Délais de déclaration (Code des assurances, art. L113-2) : 2 jours ouvrés pour un vol, 5 sinon
const DECLARATION_DELAY_DAYS = { THEFT: 2, DEFAULT: 5 };

const PLATE_FORMAT = /^[A-Z]{2}-\d{3}-[A-Z]{2}$/;

function isLateDeclaration(claimType, incidentDate, declaredAt = new Date()) {
  const limit = THEFT_TYPES.includes(claimType) ? DECLARATION_DELAY_DAYS.THEFT : DECLARATION_DELAY_DAYS.DEFAULT;
  return daysBetween(parseIsoDate(incidentDate), declaredAt) > limit;
}

/**
 * Valide et normalise une déclaration envoyée par le formulaire en ligne.
 * @returns l'objet prêt à être enregistré
 */
function validateDeclaration(input, contract, now = new Date()) {
  const errors = [];

  if (contract.status !== 'ACTIF') {
    errors.push(`Le contrat ${contract.contract_number} n'est pas actif`);
  }

  const allowedTypes = TYPES_BY_PRODUCT[contract.product] || [];
  if (!allowedTypes.includes(input.type)) {
    errors.push(`Type de sinistre "${input.type}" non couvert par un contrat ${contract.product}`);
  }

  const incidentDate = parseIsoDate(input.incidentDate);
  if (!incidentDate) {
    errors.push('Date du sinistre invalide (format attendu AAAA-MM-JJ)');
  } else if (isFutureDate(input.incidentDate, now)) {
    errors.push('La date du sinistre ne peut pas être dans le futur');
  }

  const description = (input.description || '').trim();
  if (description.length < 20) {
    errors.push('La description doit faire au moins 20 caractères');
  }

  let vehicle = null;
  if (contract.product === 'AUTO') {
    const plate = ((input.vehicle && input.vehicle.plate) || '').trim().toUpperCase();
    if (!PLATE_FORMAT.test(plate)) {
      errors.push('Immatriculation invalide (format AA-123-AA)');
    }
    vehicle = {
      plate,
      brand: input.vehicle && input.vehicle.brand ? input.vehicle.brand.trim() : null,
      model: input.vehicle && input.vehicle.model ? input.vehicle.model.trim() : null,
    };
  }

  const complaintNumber = (input.complaintNumber || '').trim();
  if (THEFT_TYPES.includes(input.type) && !complaintNumber) {
    errors.push('Le numéro de dépôt de plainte est obligatoire pour un vol');
  }

  const thirdParty = input.thirdParty || {};
  if (thirdParty.involved && !(thirdParty.name || '').trim()) {
    errors.push('Le nom du tiers impliqué est obligatoire');
  }

  let estimatedAmountCents = null;
  try {
    estimatedAmountCents = parseAmountToCents(input.estimatedAmount);
  } catch (err) {
    errors.push(...err.details);
  }

  if (errors.length > 0) {
    throw new ValidationError('Déclaration invalide', errors);
  }

  return {
    contractId: contract.id,
    type: input.type,
    incidentDate: input.incidentDate,
    incidentLocation: (input.incidentLocation || '').trim() || null,
    description,
    complaintNumber: complaintNumber || null,
    thirdParty: {
      involved: Boolean(thirdParty.involved),
      name: thirdParty.involved ? thirdParty.name.trim() : null,
      insurer: thirdParty.involved && thirdParty.insurer ? thirdParty.insurer.trim() : null,
    },
    vehicle,
    estimatedAmountCents,
    lateDeclaration: isLateDeclaration(input.type, input.incidentDate, now),
  };
}

module.exports = {
  TYPES_BY_PRODUCT,
  THEFT_TYPES,
  DECLARATION_DELAY_DAYS,
  isLateDeclaration,
  validateDeclaration,
};
