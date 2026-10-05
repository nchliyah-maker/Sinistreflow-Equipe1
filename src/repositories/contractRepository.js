const db = require('../db/pool');

/** Retrouve un contrat à partir du numéro de contrat et de l'email de l'assuré. */
async function findByNumberAndEmail(contractNumber, email) {
  const { rows } = await db.query(
    `SELECT c.*, p.first_name, p.last_name, p.email
     FROM contracts c
     JOIN policyholders p ON p.id = c.policyholder_id
     WHERE c.contract_number = $1 AND p.email = $2`,
    [String(contractNumber || '').trim().toUpperCase(), String(email || '').trim()],
  );
  return rows[0] || null;
}

module.exports = { findByNumberAndEmail };
