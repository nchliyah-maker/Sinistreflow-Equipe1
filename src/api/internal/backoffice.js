/**
 * API interne du back-office (gestionnaires sinistres MutuAlp).
 */
const express = require('express');
const basicAuth = require('../middlewares/basicAuth');
const claimRepository = require('../../repositories/claimRepository');
const claimService = require('../../services/claimService');
const { TRANSITIONS } = require('../../domain/workflow');
const { formatDate } = require('../../domain/dates');
const { toV3 } = require('../v3/claims');

const router = express.Router();
router.use(basicAuth);

function toRow(claim) {
  return {
    reference: claim.reference,
    contractNumber: claim.contract_number,
    holder: claim.last_name ? `${claim.first_name} ${claim.last_name}` : undefined,
    type: claim.claim_type,
    incidentDate: formatDate(claim.incident_date),
    declaredAt: claim.declared_at,
    status: claim.status,
    lateDeclaration: claim.late_declaration,
  };
}

router.get('/me', (req, res) => {
  res.json({ user: req.backofficeUser });
});

router.get('/claims', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = 20;
    if (req.query.q) {
      const rows = await claimRepository.search(req.query.q, { page, limit });
      return res.json({ items: rows.map(toRow), page, limit });
    }
    const { rows, total } = await claimRepository.list({ status: req.query.status || null, page, limit });
    return res.json({ items: rows.map(toRow), page, limit, total });
  } catch (err) {
    return next(err);
  }
});

router.get('/claims/:reference', async (req, res, next) => {
  try {
    const claim = await claimService.getDetailedClaim(req.params.reference);
    res.json({
      claim: toV3(claim),
      internalStatus: claim.status,
      allowedTransitions: TRANSITIONS[claim.status] || [],
    });
  } catch (err) {
    next(err);
  }
});

router.post('/claims/:reference/transition', async (req, res, next) => {
  try {
    const to = req.body && req.body.to;
    const claim = await claimService.changeStatus(req.params.reference, to, `gestionnaire:${req.backofficeUser}`);
    res.json({
      claim: toV3(claim),
      internalStatus: claim.status,
      allowedTransitions: TRANSITIONS[claim.status] || [],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
