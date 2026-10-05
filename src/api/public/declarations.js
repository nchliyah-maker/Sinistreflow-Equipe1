/**
 * Endpoints utilisés par le formulaire de déclaration en ligne (public/index.html).
 */
const express = require('express');
const claimService = require('../../services/claimService');
const { formatDate } = require('../../domain/dates');
const { ValidationError } = require('../../domain/errors');

const router = express.Router();

// Étape 1 : l'assuré s'identifie avec son numéro de contrat et son email
router.post('/contracts/verify', async (req, res, next) => {
  try {
    const { contractNumber, email } = req.body || {};
    if (!contractNumber || !email) {
      throw new ValidationError('Numéro de contrat et email obligatoires');
    }
    const contract = await claimService.verifyContract(contractNumber, email);
    if (contract.status !== 'ACTIF') {
      throw new ValidationError(`Le contrat ${contract.contract_number} n'est plus actif`);
    }
    res.json({
      contractNumber: contract.contract_number,
      product: contract.product,
      holder: { firstName: contract.first_name, lastName: contract.last_name },
      franchiseEur: contract.franchise_eur,
      allowedTypes: await claimService.getAllowedTypes(contract),
    });
  } catch (err) {
    next(err);
  }
});

// Dernière étape : envoi de la déclaration complète
router.post('/claims', async (req, res, next) => {
  try {
    const claim = await claimService.declare(req.body || {});
    res.status(201).json({
      reference: claim.reference,
      status: claim.status,
      type: claim.claim_type,
      incidentDate: formatDate(claim.incident_date),
      estimatedAmountCents: claim.estimated_amount_cents,
      lateDeclaration: claim.late_declaration,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
