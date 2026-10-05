const partnerRepository = require('../../repositories/partnerRepository');
const { UnauthorizedError } = require('../../domain/errors');

/**
 * Authentification des partenaires par clé API.
 * Le partenaire envoie sa clé dans l'en-tête HTTP "X-API-Key".
 */
module.exports = async function apiKeyAuth(req, res, next) {
  try {
    const apiKey = req.headers['X-API-Key'];
    if (!apiKey) throw new UnauthorizedError('Clé API manquante');

    const partner = await partnerRepository.findActiveByApiKey(apiKey);
    if (!partner) throw new UnauthorizedError('Clé API invalide');

    req.partner = partner;
    next();
  } catch (err) {
    next(err);
  }
};
