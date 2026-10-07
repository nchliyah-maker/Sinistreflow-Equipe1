const logger = require('../../logger');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const path = req.originalUrl.split('?')[0];

  if (status >= 500) {
    // 5xx : le détail va dans les journaux, pas dans la réponse
    logger.error('erreur serveur', { method: req.method, path, status, err });
    res.status(status).json({ error: 'Erreur interne du serveur' });
    return;
  }

  logger.warn('requête refusée', { method: req.method, path, status, error: err.message });
  res.status(status).json({
    error: err.message,
    details: err.details,
  });
};
