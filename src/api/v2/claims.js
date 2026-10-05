/**
 * API partenaires v2 (2023)
 * camelCase, montants en centimes, informations sur le tiers.
 * Utilisée par : ExpertAuto (expertises), application mobile MutuAlp.
 */
const express = require('express');
const claimService = require('../../services/claimService');
const { formatDate } = require('../../domain/dates');

const router = express.Router();

function toV2(claim) {
  return {
    reference: claim.reference,
    contractNumber: claim.contract_number,
    type: claim.claim_type,
    incidentDate: formatDate(claim.incident_date),
    incidentLocation: claim.incident_location,
    status: claim.status,
    description: claim.description,
    estimatedAmountCents: claim.estimated_amount_cents,
    indemnityCents: claim.indemnity_cents,
    vehiclePlate: claim.immatriculation,
    lateDeclaration: claim.late_declaration,
    thirdParty: {
      involved: claim.third_party_involved,
      name: claim.third_party_name,
      insurer: claim.third_party_insurer,
    },
  };
}

router.get('/claims/:reference', async (req, res, next) => {
  try {
    const claim = await claimService.getClaim(req.params.reference);
    res.json(toV2(claim));
  } catch (err) {
    next(err);
  }
});

router.post('/claims/:reference/expertise', async (req, res, next) => {
  try {
    const { expertName, appointmentDate, assessedAmountCents, conclusion } = req.body || {};
    const claim = await claimService.recordExpertise(
      req.params.reference,
      { expertName, appointmentDate, assessedAmountCents, conclusion },
      `partenaire:${req.partner.name}`,
    );
    res.status(201).json(toV2(claim));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
