const crypto = require('crypto');
const db = require('../db/pool');

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function findActiveByApiKey(apiKey) {
  const { rows } = await db.query(
    'SELECT id, name FROM partners WHERE api_key_hash = $1 AND active = true',
    [hashApiKey(apiKey)],
  );
  return rows[0] || null;
}

module.exports = { hashApiKey, findActiveByApiKey };
