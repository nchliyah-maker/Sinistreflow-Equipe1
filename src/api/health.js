const express = require('express');
const pkg = require('../../package.json');

const router = express.Router();

// Utilisé par le load-balancer et (un jour) par la supervision
router.get('/health', (req, res) => {
  res.json({ status: 'UP', version: pkg.version });
});

module.exports = router;
