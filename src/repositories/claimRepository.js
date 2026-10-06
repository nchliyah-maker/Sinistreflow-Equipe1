const db = require('../db/pool');

const BASE_SELECT = `
  SELECT c.*, ct.contract_number, ct.product, ct.franchise_eur
  FROM claims c
  JOIN contracts ct ON ct.id = c.contract_id`;

/** Génère la prochaine référence de dossier : SIN-<année>-<numéro sur 6 chiffres> */
async function nextReference(client) {
  const year = new Date().getFullYear();
  const { rows } = await client.query("SELECT nextval('claim_reference_seq') AS n");
  const next = parseInt(rows[0].n, 10);
  return `SIN-${year}-${String(next).padStart(6, '0')}`;
}

async function create(claim) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const reference = await nextReference(client);

    const { rows } = await client.query(
      `INSERT INTO claims (
         reference, contract_id, claim_type, incident_date, incident_location, description,
         complaint_number, third_party_involved, third_party_name, third_party_insurer,
         estimated_amount_cents, late_declaration, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'DECLARE')
       RETURNING id`,
      [
        reference,
        claim.contractId,
        claim.type,
        claim.incidentDate,
        claim.incidentLocation,
        claim.description,
        claim.complaintNumber,
        claim.thirdParty.involved,
        claim.thirdParty.name,
        claim.thirdParty.insurer,
        claim.estimatedAmountCents,
        claim.lateDeclaration,
      ],
    );
    const claimId = rows[0].id;

    // Depuis la migration 8 les véhicules sont stockés dans leur propre table
    if (claim.vehicle) {
      await client.query(
        'INSERT INTO vehicles (claim_id, plate_number, brand, model) VALUES ($1, $2, $3, $4)',
        [claimId, claim.vehicle.plate, claim.vehicle.brand, claim.vehicle.model],
      );
    }

    await client.query(
      `INSERT INTO claim_status_history (claim_id, from_status, to_status, changed_by)
       VALUES ($1, NULL, 'DECLARE', 'assure')`,
      [claimId],
    );

    await client.query('COMMIT');
    return reference;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Lecture "historique" utilisée par les API v1 et v2. */
async function findByReference(reference) {
  const { rows } = await db.query(`${BASE_SELECT} WHERE c.reference = $1`, [reference]);
  return rows[0] || null;
}

/** Lecture complète (véhicule, expertise, historique) utilisée par l'API v3 et le back-office. */
async function findDetailedByReference(reference) {
  const { rows } = await db.query(
    `SELECT c.*, ct.contract_number, ct.product, ct.franchise_eur,
            v.plate_number, v.brand AS vehicle_brand, v.model AS vehicle_model,
            e.expert_name, e.appointment_date, e.assessed_amount_cents, e.conclusion AS expertise_conclusion
     FROM claims c
     JOIN contracts ct ON ct.id = c.contract_id
     LEFT JOIN vehicles v ON v.claim_id = c.id
     LEFT JOIN expertises e ON e.claim_id = c.id
     WHERE c.reference = $1`,
    [reference],
  );
  if (!rows[0]) return null;

  const history = await db.query(
    `SELECT from_status, to_status, changed_at, changed_by
     FROM claim_status_history WHERE claim_id = $1 ORDER BY changed_at, id`,
    [rows[0].id],
  );
  return { ...rows[0], history: history.rows };
}

/** Liste paginée (page commence à 1). */
async function list({ status = null, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const where = status ? 'WHERE c.status = $1' : '';
  const params = status ? [status] : [];

  const { rows } = await db.query(
    `${BASE_SELECT} ${where} ORDER BY c.declared_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  const count = await db.query(`SELECT COUNT(*) AS total FROM claims c ${where}`, params);

  return { rows, total: parseInt(count.rows[0].total, 10) };
}

/** Recherche back-office par référence, numéro de contrat ou nom de l'assuré. */
async function search(q, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const sql = `
    SELECT c.*, ct.contract_number, ct.product, ct.franchise_eur, p.first_name, p.last_name
    FROM claims c
    JOIN contracts ct ON ct.id = c.contract_id
    JOIN policyholders p ON p.id = ct.policyholder_id
    WHERE c.reference ILIKE $1
       OR ct.contract_number ILIKE $1
       OR p.last_name ILIKE $1
    ORDER BY c.declared_at DESC
    LIMIT $2 OFFSET $3`;
  const { rows } = await db.query(sql, [`%${q}%`, limit, offset]);
  return rows;
}

async function saveExpertise(claim, expertise, indemnityCents, changedBy) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO expertises (claim_id, expert_name, appointment_date, assessed_amount_cents, conclusion)
       VALUES ($1, $2, $3, $4, $5)`,
      [claim.id, expertise.expertName, expertise.appointmentDate, expertise.assessedAmountCents, expertise.conclusion],
    );
    await client.query(
      `UPDATE claims SET status = 'EXPERTISE_TERMINEE', indemnity_cents = $2 WHERE id = $1`,
      [claim.id, indemnityCents],
    );
    await client.query(
      `INSERT INTO claim_status_history (claim_id, from_status, to_status, changed_by)
       VALUES ($1, $2, 'EXPERTISE_TERMINEE', $3)`,
      [claim.id, claim.status, changedBy],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateStatus(claim, toStatus, changedBy) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE claims SET status = $2 WHERE id = $1', [claim.id, toStatus]);
    await client.query(
      `INSERT INTO claim_status_history (claim_id, from_status, to_status, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [claim.id, claim.status, toStatus, changedBy],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  create,
  findByReference,
  findDetailedByReference,
  list,
  search,
  saveExpertise,
  updateStatus,
};
