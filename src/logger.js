/**
 * Journaux structurés : une ligne JSON par événement, sur la sortie standard.
 * C'est Docker (puis l'outil de collecte) qui se charge de les stocker.
 *
 * Niveau réglable par LOG_LEVEL : debug, info (défaut), warn, error, silent.
 * Pendant les tests (NODE_ENV=test) les journaux sont coupés, sauf si LOG_LEVEL est défini.
 */
const LEVELS = {
  debug: 10, info: 20, warn: 30, error: 40, silent: 100,
};

function threshold() {
  const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');
  return LEVELS[level] || LEVELS.info;
}

/** Une Error ne se sérialise pas toute seule en JSON : on garde son nom, son message et sa pile. */
function serialize(value) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function log(level, msg, fields = {}) {
  if (LEVELS[level] < threshold()) return;
  const entry = { time: new Date().toISOString(), level, msg };
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined) entry[key] = serialize(value);
  });
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

const logger = {
  debug: (msg, fields) => log('debug', msg, fields),
  info: (msg, fields) => log('info', msg, fields),
  warn: (msg, fields) => log('warn', msg, fields),
  error: (msg, fields) => log('error', msg, fields),
};

/** Routes appelées en boucle par les sondes : journalisées seulement au niveau debug. */
const PROBES = ['/health', '/metrics'];

function levelFor(req, status) {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return PROBES.includes(req.path) ? 'debug' : 'info';
}

/** Journalise chaque requête terminée : méthode, route, statut, durée, partenaire. */
function requestLogger(routeLabel) {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      logger[levelFor(req, res.statusCode)]('requête', {
        method: req.method,
        route: routeLabel(req),
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        partner: req.partner ? req.partner.name : undefined,
      });
    });
    next();
  };
}

module.exports = { ...logger, requestLogger };
