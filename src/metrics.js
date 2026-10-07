/**
 * Métriques Prometheus de SinistreFlow, exposées sur GET /metrics.
 *
 * - RED par route : compteur de requêtes et histogramme de durées (méthode, route, statut)
 * - saturation : état du pool de connexions PostgreSQL
 * - métier : déclarations par type, expertises déposées, appels par version d'API et partenaire
 * - métriques par défaut de Node.js (CPU, mémoire, boucle d'événements)
 */
const client = require('prom-client');
const db = require('./db/pool');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
  name: 'sinistreflow_http_requests_total',
  help: 'Nombre de requêtes HTTP traitées',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpDuration = new client.Histogram({
  name: 'sinistreflow_http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const dbPool = new client.Gauge({
  name: 'sinistreflow_db_pool_connections',
  help: 'Connexions du pool PostgreSQL par état (total, idle, waiting)',
  labelNames: ['state'],
  registers: [register],
  collect() {
    this.set({ state: 'total' }, db.pool.totalCount);
    this.set({ state: 'idle' }, db.pool.idleCount);
    this.set({ state: 'waiting' }, db.pool.waitingCount);
  },
});

const claimsDeclared = new client.Counter({
  name: 'sinistreflow_claims_declared_total',
  help: 'Déclarations de sinistre enregistrées, par type de sinistre',
  labelNames: ['type'],
  registers: [register],
});

const expertisesSubmitted = new client.Counter({
  name: 'sinistreflow_expertises_submitted_total',
  help: "Rapports d'expertise déposés, par partenaire",
  labelNames: ['partner'],
  registers: [register],
});

const apiRequests = new client.Counter({
  name: 'sinistreflow_api_requests_total',
  help: "Appels à l'API partenaires, par version et par partenaire",
  labelNames: ['version', 'partner'],
  registers: [register],
});

/**
 * Étiquette "route" : le MOTIF de la route (/api/v2/claims/:reference), jamais l'URL réelle.
 * Une étiquette par dossier créerait une série par dossier et ferait exploser Prometheus.
 */
function routeLabel(req) {
  // req.baseUrl est remis à zéro par Express quand une erreur remonte : on garde le préfixe
  // mémorisé par rememberMount au moment où la requête est entrée dans le routeur.
  const mount = req.metricsMount || req.baseUrl;
  if (req.route) return `${mount}${req.route.path}`;
  if (mount) return `${mount}/*`; // arrêtée avant la route (authentification refusée, 404)
  if (req.originalUrl.startsWith('/api/')) return 'api_inconnue';
  return 'statique';
}

/** À monter sur chaque préfixe d'API, avant son routeur. */
function rememberMount(req, res, next) {
  req.metricsMount = req.baseUrl;
  next();
}

/** Mesure chaque requête, sauf /metrics lui-même (c'est Prometheus qui l'appelle). */
function middleware(req, res, next) {
  if (req.path === '/metrics') return next();
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const labels = { method: req.method, route: routeLabel(req), status: String(res.statusCode) };
    httpRequests.inc(labels);
    end(labels);
    if (req.partner) {
      const version = ((req.metricsMount || '').match(/^\/api\/(v\d+)/) || [])[1];
      if (version) apiRequests.inc({ version, partner: req.partner.name });
    }
  });
  return next();
}

async function handler(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = {
  register,
  routeLabel,
  rememberMount,
  middleware,
  handler,
  dbPool,
  claimsDeclared,
  expertisesSubmitted,
  apiRequests,
};
