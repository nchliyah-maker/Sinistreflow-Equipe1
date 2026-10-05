/**
 * API partenaires v3 (2025)
 * Ressource imbriquée, statuts en anglais, véhicule et expertise inclus.
 */
const express = require('express');
const claimRepository = require('../../repositories/claimRepository');
const claimService = require('../../services/claimService');
const { formatDate } = require('../../domain/dates');
const { ValidationError } = require('../../domain/errors');

const router = express.Router();

const STATUS_V3 = {
  DECLARE: 'DECLARED',
  EN_INSTRUCTION: 'UNDER_REVIEW',
  EXPERTISE_EN_COURS: 'ASSESSMENT_PENDING',
  EXPERTISE_TERMINEE: 'ASSESSMENT_DONE',
  ACCEPTE: 'ACCEPTED',
  REFUSE: 'REJECTED',
  INDEMNISE: 'PAID',
  CLOS: 'CLOSED',
};
const STATUS_FROM_V3 = Object.fromEntries(Object.entries(STATUS_V3).map(([fr, en]) => [en, fr]));

const toNumber = (value) => (value === null || value === undefined ? null : Number(value));

function toV3Summary(claim) {
  return {
    reference: claim.reference,
    status: STATUS_V3[claim.status],
    contract: { number: claim.contract_number, product: claim.product },
    incident: { type: claim.claim_type, date: formatDate(claim.incident_date) },
    declaredAt: claim.declared_at,
  };
}

function toV3(claim) {
  return {
    reference: claim.reference,
    status: STATUS_V3[claim.status],
    declaredAt: claim.declared_at,
    lateDeclaration: claim.late_declaration,
    contract: {
      number: claim.contract_number,
      product: claim.product,
      deductibleCents: toNumber(claim.franchise_eur) * 100,
    },
    incident: {
      type: claim.claim_type,
      date: formatDate(claim.incident_date),
      location: claim.incident_location,
      description: claim.description,
      complaintNumber: claim.complaint_number,
    },
    vehicle: claim.plate_number
      ? { plate: claim.plate_number, brand: claim.vehicle_brand, model: claim.vehicle_model }
      : null,
    thirdParty: {
      involved: claim.third_party_involved,
      name: claim.third_party_name,
      insurer: claim.third_party_insurer,
    },
    amounts: {
      estimatedCents: toNumber(claim.estimated_amount_cents),
      assessedCents: toNumber(claim.assessed_amount_cents),
      indemnityCents: toNumber(claim.indemnity_cents),
    },
    expertise: claim.expert_name
      ? {
          expert: { name: claim.expert_name },
          appointmentDate: formatDate(claim.appointment_date),
          conclusion: claim.expertise_conclusion,
        }
      : null,
    history: (claim.history || []).map((h) => ({
      from: h.from_status ? STATUS_V3[h.from_status] : null,
      to: STATUS_V3[h.to_status],
      at: h.changed_at,
      by: h.changed_by,
    })),
  };
}

router.get('/claims', async (req, res, next) => {
  try {
    let status = null;
    if (req.query.status) {
      status = STATUS_FROM_V3[req.query.status];
      if (!status) throw new ValidationError(`Statut inconnu : ${req.query.status}`);
    }
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const { rows, total } = await claimRepository.list({ status, page, limit });
    res.json({ items: rows.map(toV3Summary), pagination: { page, limit, total } });
  } catch (err) {
    next(err);
  }
});

router.get('/claims/:reference', async (req, res, next) => {
  try {
    const claim = await claimService.getDetailedClaim(req.params.reference);
    res.json(toV3(claim));
  } catch (err) {
    next(err);
  }
});

router.post('/claims/:reference/expertise', async (req, res, next) => {
  try {
    const body = req.body || {};
    await claimService.recordExpertise(
      req.params.reference,
      {
        expertName: body.expert && body.expert.name,
        appointmentDate: body.appointmentDate,
        assessedAmountCents: body.assessedCents,
        conclusion: body.conclusion,
      },
      `partenaire:${req.partner.name}`,
    );
    const claim = await claimService.getDetailedClaim(req.params.reference);
    res.status(201).json(toV3(claim));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.toV3 = toV3;
module.exports.STATUS_V3 = STATUS_V3;
