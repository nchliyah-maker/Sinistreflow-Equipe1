/**
 * API partenaires v1 (2021)
 * Format historique : snake_case, libellés français, montants en euros.
 */
const express = require('express');
const claimRepository = require('../../repositories/claimRepository');
const claimService = require('../../services/claimService');
const { formatDate } = require('../../domain/dates');
const { centsToEuros } = require('../../domain/money');

const router = express.Router();

function toV1(claim) {
  return {
    id: claim.id,
    reference: claim.reference,
    numero_contrat: claim.contract_number,
    type_sinistre: claim.claim_type,
    date_sinistre: formatDate(claim.incident_date),
    statut: claim.status,
    description: claim.description,
    montant_estime: centsToEuros(claim.estimated_amount_cents),
    immatriculation: claim.immatriculation,
  };
}

router.get('/claims', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const { rows, total } = await claimRepository.list({ status: req.query.statut || null, page, limit });
    res.json({ data: rows.map(toV1), page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.get('/claims/:reference', async (req, res, next) => {
  try {
    const claim = await claimService.getClaim(req.params.reference);
    res.json(toV1(claim));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
