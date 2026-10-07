const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (file) => (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '');

/** Stack complète (application + supervision) telle que Docker la comprend. */
function stack() {
  const json = execSync(
    'docker compose -f docker-compose.yml -f docker-compose.monitoring.yml config --format json',
    {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GRAFANA_ADMIN_PASSWORD: process.env.GRAFANA_ADMIN_PASSWORD || 'valeur-de-test' },
    },
  );
  return JSON.parse(json).services;
}

describe('SF-502 : stack de supervision', () => {
  let services;

  beforeAll(() => {
    services = stack();
  });

  test.each(['prometheus', 'grafana', 'node-exporter', 'postgres-exporter', 'blackbox'])(
    'le service %s est déclaré, avec une version d\'image figée',
    (name) => {
      expect(services[name]).toBeDefined();
      expect(services[name].image).toMatch(/:v?\d+\.\d+\.\d+$/);
    },
  );

  test('rien n\'est exposé publiquement : seuls des ports liés à 127.0.0.1', () => {
    Object.values(services).forEach((service) => {
      (service.ports || []).forEach((port) => expect(port.host_ip).toBe('127.0.0.1'));
    });
  });

  test('les exporters ne publient aucun port sur la machine', () => {
    ['node-exporter', 'postgres-exporter', 'blackbox'].forEach((name) => {
      expect(services[name].ports || []).toEqual([]);
    });
  });

  test('le mot de passe Grafana vient de l\'environnement, pas du fichier', () => {
    const line = read('docker-compose.monitoring.yml').split(/\r?\n/)
      .find((l) => l.includes('GF_SECURITY_ADMIN_PASSWORD'));

    expect(line).toMatch(/GF_SECURITY_ADMIN_PASSWORD:\s*\$\{GRAFANA_ADMIN_PASSWORD/);
    expect(read('.env.example')).toMatch(/^GRAFANA_ADMIN_PASSWORD=$/m);
  });

  test('Prometheus collecte l\'application, la machine, la base et la sonde', () => {
    const config = read('monitoring/prometheus/prometheus.yml');

    ['sinistreflow', 'node', 'postgres', 'blackbox'].forEach((job) => {
      expect(config).toMatch(new RegExp(`job_name: ${job}\\b`));
    });
    expect(config).toContain('app:3000');
    expect(config).toContain('http://app:3000/health');
  });

  test('la source de données Grafana est provisionnée par fichier', () => {
    const datasource = read('monitoring/grafana/provisioning/datasources/prometheus.yml');

    expect(datasource).toContain('type: prometheus');
    expect(datasource).toContain('url: http://prometheus:9090');
    expect(read('monitoring/grafana/provisioning/dashboards/dashboards.yml')).toContain('/var/lib/grafana/dashboards');
  });
});

describe('SF-502 : tableau de bord Grafana', () => {
  const dashboard = JSON.parse(read('monitoring/grafana/dashboards/sinistreflow.json') || '{"panels":[]}');
  const titles = dashboard.panels.map((panel) => panel.title);
  const queries = dashboard.panels.flatMap((panel) => (panel.targets || []).map((t) => t.expr)).join('\n');

  test.each([
    'Application', 'Base de données', 'Sonde /health', 'Requêtes / s', 'Erreurs 5xx', 'Latence p95',
    'Déclarations (24 h)', 'Expertises déposées (24 h)', 'Usage des versions d\'API, par partenaire',
    'CPU de la machine (%)', 'Mémoire de la machine (%)', 'Disque (% utilisé)',
  ])('panneau "%s"', (title) => {
    expect(titles).toContain(title);
  });

  test('les panneaux interrogent les métriques réellement exposées par l\'application', () => {
    [
      'sinistreflow_http_requests_total', 'sinistreflow_http_request_duration_seconds_bucket',
      'sinistreflow_claims_declared_total', 'sinistreflow_expertises_submitted_total',
      'sinistreflow_api_requests_total', 'sinistreflow_db_pool_connections',
    ].forEach((metric) => expect(queries).toContain(metric));
  });

  test('chaque panneau utilise la source de données provisionnée', () => {
    dashboard.panels.filter((panel) => panel.type !== 'row').forEach((panel) => {
      expect(panel.datasource).toEqual({ type: 'prometheus', uid: 'prometheus' });
    });
  });
});
