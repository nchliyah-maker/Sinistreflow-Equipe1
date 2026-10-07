const {
  app, request, partner, backoffice, declare, moveTo, day, cleanup,
} = require('./helpers');

afterAll(cleanup);

/** Texte renvoyé par GET /metrics. */
async function metrics() {
  const res = await request(app).get('/metrics');
  expect(res.status).toBe(200);
  return res.text;
}

/** Valeur d'une série : nom de la métrique + étiquettes attendues (dans l'ordre d'exposition). */
function value(text, name, labels) {
  const line = text.split('\n').find((l) => l.startsWith(`${name}{`) && labels.every((label) => l.includes(label)));
  return line ? Number(line.split(' ').pop()) : 0;
}

describe('SF-501 : métriques Prometheus sur /metrics', () => {
  test('le format est celui de Prometheus', async () => {
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('# TYPE sinistreflow_http_requests_total counter');
    expect(res.text).toContain('# TYPE sinistreflow_http_request_duration_seconds histogram');
  });

  test('les métriques par défaut de Node.js sont exposées', async () => {
    const text = await metrics();

    expect(text).toContain('process_cpu_seconds_total');
    expect(text).toContain('nodejs_eventloop_lag_seconds');
    expect(text).toContain('nodejs_heap_size_used_bytes');
  });

  test('l\'état du pool PostgreSQL est exposé', async () => {
    const text = await metrics();

    ['total', 'idle', 'waiting'].forEach((state) => {
      expect(text).toMatch(new RegExp(`sinistreflow_db_pool_connections\\{state="${state}"\\} \\d+`));
    });
  });

  test('chaque requête est comptée par méthode, route et statut', async () => {
    const labels = ['method="GET"', 'route="/api/v1/claims/:reference"', 'status="200"'];
    const before = value(await metrics(), 'sinistreflow_http_requests_total', labels);

    await partner('get', '/api/v1/claims/SIN-2026-000450');
    await partner('get', '/api/v1/claims/SIN-2026-000452');

    const text = await metrics();
    expect(value(text, 'sinistreflow_http_requests_total', labels)).toBe(before + 2);
    expect(text).toMatch(/sinistreflow_http_request_duration_seconds_bucket\{le="0\.5",method="GET",route="\/api\/v1\/claims\/:reference",status="200"\} \d+/);
  });

  test('cardinalité : la route est un motif, jamais une référence de dossier', async () => {
    await partner('get', '/api/v2/claims/SIN-2026-000450');
    await partner('get', '/api/v3/claims/SIN-1999-000000'); // 404
    await request(app).get('/api/nimporte/quoi'); //         route inconnue
    await request(app).get('/page-inexistante.html'); //     fichier statique

    const text = await metrics();
    expect(text).not.toMatch(/route="[^"]*SIN-/);
    expect(text).not.toContain('nimporte');
    expect(text).not.toContain('page-inexistante');
    expect(text).toContain('route="/api/v3/claims/:reference",status="404"');
    expect(text).toContain('route="api_inconnue",status="404"');
  });

  test('les erreurs sont comptées avec leur code HTTP', async () => {
    const labels = ['method="GET"', 'route="/api/internal/*"', 'status="401"'];
    const before = value(await metrics(), 'sinistreflow_http_requests_total', labels);

    await request(app).get('/api/internal/claims'); // sans identifiants

    expect(value(await metrics(), 'sinistreflow_http_requests_total', labels)).toBe(before + 1);
  });

  test('/metrics ne se compte pas lui-même', async () => {
    await metrics();

    expect(await metrics()).not.toContain('route="/metrics"');
  });
});

describe('SF-501 : métriques métier', () => {
  test('déclarations par type de sinistre', async () => {
    const labels = ['type="AUTO_COLLISION"'];
    const before = value(await metrics(), 'sinistreflow_claims_declared_total', labels);

    await declare();
    await declare({ incidentDate: day(1) }); // refusée : ne doit pas être comptée

    expect(value(await metrics(), 'sinistreflow_claims_declared_total', labels)).toBe(before + 1);
  });

  test('expertises déposées par partenaire', async () => {
    const labels = ['partner="ExpertAuto"'];
    const before = value(await metrics(), 'sinistreflow_expertises_submitted_total', labels);
    const { body } = await declare();
    await moveTo(body.reference, 'EN_INSTRUCTION', 'EXPERTISE_EN_COURS');

    await partner('post', `/api/v2/claims/${body.reference}/expertise`).send({
      expertName: 'Cabinet ExpertAuto - J. Morel',
      appointmentDate: day(-1),
      assessedAmountCents: 112545,
      conclusion: 'Dommages conformes à la déclaration.',
    });

    expect(value(await metrics(), 'sinistreflow_expertises_submitted_total', labels)).toBe(before + 1);
  });

  test('appels par version d\'API et par partenaire', async () => {
    const count = async (version) => value(
      await metrics(),
      'sinistreflow_api_requests_total',
      [`version="${version}"`, 'partner="ExpertAuto"'],
    );
    const before = { v1: await count('v1'), v2: await count('v2'), v3: await count('v3') };

    await partner('get', '/api/v1/claims?limit=1');
    await partner('get', '/api/v2/claims/SIN-2026-000450');
    await partner('get', '/api/v2/claims/SIN-2026-000452');
    await partner('get', '/api/v3/claims?limit=1');
    await backoffice('get', '/api/internal/claims'); // pas un appel partenaire

    expect(await count('v1')).toBe(before.v1 + 1);
    expect(await count('v2')).toBe(before.v2 + 2);
    expect(await count('v3')).toBe(before.v3 + 1);
  });
});
