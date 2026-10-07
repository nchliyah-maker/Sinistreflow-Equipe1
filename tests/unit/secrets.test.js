const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (file) => (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '');

const REQUIRED = {
  DB_PASSWORD: 'mot-de-passe-de-test',
  BACKOFFICE_USER: 'gestionnaire-de-test',
  BACKOFFICE_PASSWORD: 'autre-mot-de-passe-de-test',
};

/** Charge src/config.js avec un environnement maîtrisé, sans lire le fichier .env du poste. */
function loadConfig(env) {
  const saved = process.env;
  process.env = { ...env };
  let config;
  jest.isolateModules(() => {
    jest.doMock('dotenv', () => ({ config: () => ({}) }));
    // eslint-disable-next-line global-require
    config = require('../../src/config');
  });
  process.env = saved;
  return config;
}

describe('SF-204 : aucun secret dans le dépôt', () => {
  test('le fichier .env n\'est plus suivi par Git', () => {
    const tracked = execSync('git ls-files .env', { cwd: ROOT, encoding: 'utf8' }).trim();

    expect(tracked).toBe('');
  });

  test('.gitignore empêche de committer un fichier .env', () => {
    const ignored = read('.gitignore').split(/\r?\n/).map((l) => l.trim());

    expect(ignored).toContain('.env');
  });

  test('.env.example liste les variables, sans aucune valeur secrète', () => {
    const example = read('.env.example');

    expect(example).not.toBe('');
    ['DB_PASSWORD', 'BACKOFFICE_PASSWORD', 'EXPERTAUTO_API_KEY'].forEach((name) => {
      expect(example).toMatch(new RegExp(`^${name}=$`, 'm'));
    });
  });

  test('docker-compose.yml lit le mot de passe de la base dans l\'environnement', () => {
    const line = read('docker-compose.yml').split(/\r?\n/).find((l) => l.includes('POSTGRES_PASSWORD'));

    expect(line).toMatch(/POSTGRES_PASSWORD:\s*\$\{DB_PASSWORD/);
  });
});

describe('SF-204 : aucun secret par défaut dans le code', () => {
  test.each(Object.keys(REQUIRED))('sans %s, l\'application refuse de démarrer', (name) => {
    const env = { ...REQUIRED };
    delete env[name];

    expect(() => loadConfig(env)).toThrow(name);
  });

  test('les secrets viennent uniquement des variables d\'environnement', () => {
    const config = loadConfig(REQUIRED);

    expect(config.db.password).toBe(REQUIRED.DB_PASSWORD);
    expect(config.backoffice.user).toBe(REQUIRED.BACKOFFICE_USER);
    expect(config.backoffice.password).toBe(REQUIRED.BACKOFFICE_PASSWORD);
  });

  test('les réglages non sensibles gardent une valeur par défaut', () => {
    const config = loadConfig(REQUIRED);

    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.db.host).toBe('localhost');
    expect(config.db.port).toBe(5432);
  });
});
