const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

/** Configuration compose telle que Docker la comprend (fichier résolu, variables remplacées). */
function composeConfig() {
  const json = execSync('docker compose config --format json', { cwd: ROOT, encoding: 'utf8' });
  return JSON.parse(json).services;
}

describe('SF-202 : l\'application trouve la base dans docker compose', () => {
  let services;

  beforeAll(() => {
    services = composeConfig();
  });

  test('l\'application joint la base par le nom du service, pas par localhost', () => {
    expect(services.app.environment.DB_HOST).toBe('db');
  });

  test('la base a un healthcheck pg_isready', () => {
    expect(services.db.healthcheck).toBeDefined();
    expect(services.db.healthcheck.test.join(' ')).toContain('pg_isready');
  });

  test('l\'application attend que la base soit prête, pas seulement démarrée', () => {
    expect(services.app.depends_on.db.condition).toBe('service_healthy');
  });

  test('PostgreSQL n\'est pas joignable depuis l\'extérieur de la machine', () => {
    (services.db.ports || []).forEach((port) => expect(port.host_ip).toBe('127.0.0.1'));
  });

  test('l\'application n\'est publiée que sur la machine elle-même', () => {
    expect(services.app.ports.length).toBeGreaterThan(0);
    services.app.ports.forEach((port) => expect(port.host_ip).toBe('127.0.0.1'));
  });
});

describe('SF-206 : les migrations sont jouées à chaque déploiement', () => {
  let services;

  beforeAll(() => {
    services = composeConfig();
  });

  test('un service "migrate" lance le script de migration', () => {
    expect(services.migrate).toBeDefined();
    expect(services.migrate.command.join(' ')).toContain('src/db/migrate.js');
  });

  test('le service "migrate" s\'exécute une seule fois, quand la base est prête', () => {
    expect(services.migrate.restart).toBe('no');
    expect(services.migrate.depends_on.db.condition).toBe('service_healthy');
    expect(services.migrate.environment.DB_HOST).toBe('db');
  });

  test('l\'application ne démarre que si les migrations ont réussi', () => {
    expect(services.app.depends_on.migrate.condition).toBe('service_completed_successfully');
  });

  test('l\'application a un healthcheck qui interroge /health', () => {
    expect(services.app.healthcheck).toBeDefined();
    expect(services.app.healthcheck.test.join(' ')).toContain('/health');
  });
});
