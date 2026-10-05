const config = require('../../config');
const { UnauthorizedError } = require('../../domain/errors');

/** Authentification HTTP Basic des gestionnaires du back-office. */
module.exports = function basicAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    return next(new UnauthorizedError('Authentification gestionnaire requise'));
  }
  const [user, password] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
  if (user !== config.backoffice.user || password !== config.backoffice.password) {
    return next(new UnauthorizedError('Identifiants gestionnaire invalides'));
  }
  req.backofficeUser = user;
  return next();
};
