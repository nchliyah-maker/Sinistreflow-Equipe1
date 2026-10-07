const express = require('express');
const pkg = require('../../package.json');
const db = require('../db/pool');
const logger = require('../logger');

const router = express.Router();

// Utilisé par le load-balancer et (un jour) par la supervision
router.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'UP', version: pkg.version, database: 'UP' });
  } catch (err) {
    logger.error('base de données injoignable', { err });
    res.status(503).json({ status: 'DOWN', version: pkg.version, database: 'DOWN' });
  }
});

module.exports = router;
