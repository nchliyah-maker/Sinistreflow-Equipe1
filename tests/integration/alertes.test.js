const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (file) => (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '');

/** Découpe alerts.yml en un bloc de texte par règle (sans bibliothèque YAML). */
function rules() {
  return read('monitoring/prometheus/alerts.yml')
    .split(/^\s*- alert:\s*/m)
    .slice(1)
    .map((block) => ({ name: block.split(/\r?\n/)[0].trim(), text: block }));
}

describe('SF-503 : règles d\'alerte', () => {
  const all = rules();
  const byName = Object.fromEntries(all.map((rule) => [rule.name, rule.text]));

  test('au moins 5 règles', () => {
    expect(all.length).toBeGreaterThanOrEqual(5);
  });

  test('chaque règle a une durée "for", une sévérité et un résumé', () => {
    all.forEach((rule) => {
      expect(rule.text).toMatch(/^\s*for: \d+[sm]$/m);
      expect(rule.text).toMatch(/^\s*severity: (critical|warning)$/m);
      expect(rule.text).toMatch(/^\s*summary: ".+"$/m);
    });
  });

  test.each([
    ['ApplicationInjoignable', 'up{job="sinistreflow"} == 0'],
    ['SanteEnEchec', 'probe_success{job="blackbox"} == 0'],
    ['BaseDeDonneesInjoignable', 'pg_up == 0'],
    ['TauxErreurs5xxEleve', '> 5'],
    ['LatenceP95Elevee', '> 1'],
    ['DisquePresquePlein', '< 10'],
  ])('alerte %s : condition "%s"', (name, condition) => {
    expect(byName[name]).toBeDefined();
    expect(byName[name]).toContain(condition);
  });

  test('les pannes sont critiques, les dégradations sont des avertissements', () => {
    ['ApplicationInjoignable', 'SanteEnEchec', 'BaseDeDonneesInjoignable'].forEach((name) => {
      expect(byName[name]).toMatch(/severity: critical/);
    });
    ['TauxErreurs5xxEleve', 'LatenceP95Elevee', 'DisquePresquePlein'].forEach((name) => {
      expect(byName[name]).toMatch(/severity: warning/);
    });
  });

  test('les règles n\'utilisent que des métriques collectées', () => {
    const text = read('monitoring/prometheus/alerts.yml');

    expect(text).toContain('sinistreflow_http_requests_total');
    expect(text).toContain('sinistreflow_http_request_duration_seconds_bucket');
    expect(text).toContain('node_filesystem_avail_bytes');
  });
});

describe('SF-503 : envoi des alertes', () => {
  test('Prometheus charge les règles et connaît Alertmanager', () => {
    const config = read('monitoring/prometheus/prometheus.yml');

    expect(config).toMatch(/rule_files:\s*\r?\n\s*- alerts\.yml/);
    expect(config).toContain('alertmanager:9093');
  });

  test('Alertmanager est déclaré et n\'est publié que sur 127.0.0.1', () => {
    const json = execSync(
      'docker compose -f docker-compose.yml -f docker-compose.monitoring.yml config --format json',
      {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GRAFANA_ADMIN_PASSWORD: process.env.GRAFANA_ADMIN_PASSWORD || 'valeur-de-test' },
      },
    );
    const { alertmanager } = JSON.parse(json).services;

    expect(alertmanager).toBeDefined();
    alertmanager.ports.forEach((port) => expect(port.host_ip).toBe('127.0.0.1'));
  });

  test('les alertes partent sur Discord, résolutions comprises', () => {
    const config = read('monitoring/alertmanager/alertmanager.yml');

    expect(config).toContain('discord_configs:');
    expect(config).toContain('send_resolved: true');
  });

  test('l\'URL du webhook est un secret : lue dans un fichier ignoré par Git', () => {
    const config = read('monitoring/alertmanager/alertmanager.yml');

    expect(config).toContain('webhook_url_file: /etc/alertmanager/secrets/discord_webhook_url');
    expect(config).not.toMatch(/https:\/\/discord(app)?\.com\/api\/webhooks\//);
    expect(read('.gitignore')).toContain('monitoring/alertmanager/secrets/');
  });
});
