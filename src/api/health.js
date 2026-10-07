const express = require('express');
const pkg = require('../../package.json');
const db = require('../db/pool');
const logger = require('../logger');

const router = express.Router();

// Utilisé par le load-balancer et (un jour) par la supervision
const DB_TIMEOUT_MS = 2000;

// Une base arrêtée ne refuse pas toujours la connexion : elle peut ne jamais répondre.
function checkDatabase() {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`base sans réponse après ${DB_TIMEOUT_MS} ms`)), DB_TIMEOUT_MS);
  });
  const query = db.query('SELECT 1');
  query.catch(() => {});
  return Promise.race([query, timeout]).finally(() => clearTimeout(timer));
}

router.get('/health', async (req, res) => {
  try {
    await checkDatabase();
    res.json({ status: 'UP', version: pkg.version, database: 'UP' });
  } catch (err) {
    logger.error('base de données injoignable', { err });
    res.status(503).json({ status: 'DOWN', version: pkg.version, database: 'DOWN' });
  }
});

module.exports = router;
