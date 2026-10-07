const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (file) => (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '');

describe('SF-602 : script de déploiement avec retour arrière', () => {
  const script = read('deploy/deploy.sh');

  test('le script s\'arrête à la première erreur et garde des fins de ligne Linux', () => {
    expect(script).toMatch(/^set -euo pipefail$/m);
    expect(script).not.toContain('\r\n');
  });

  test('l\'image à déployer est un argument obligatoire', () => {
    expect(script).toContain('NEW_IMAGE="${1:-}"');
    expect(script).toMatch(/Usage : bash deploy\/deploy\.sh <image:tag>/);
  });

  test('les étapes s\'enchaînent : image, migrations et démarrage, /health, connecteur', () => {
    const order = ['pull --quiet app migrate', 'start_stack "$NEW_IMAGE"', 'wait_health ||', 'bash deploy/run-connector.sh']
      .map((step) => script.lastIndexOf(step));

    order.forEach((position) => expect(position).toBeGreaterThan(-1));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test('chaque étape qui échoue déclenche le retour arrière', () => {
    expect((script.match(/\|\| rollback "/g) || []).length).toBe(4);
  });

  test('le retour arrière redémarre l\'image précédente et vérifie /health', () => {
    expect(script).toMatch(/start_stack "\$PREVIOUS_IMAGE" && wait_health/);
    expect(script).toContain('RETOUR ARRIERE OK');
  });

  test('l\'application n\'est jamais reconstruite sur la VM : on déploie l\'image de la CI', () => {
    expect(script).toContain('up -d --no-build');
    expect(script).not.toMatch(/up -d[^\n]*--build\b/);
  });

  test('chaque déploiement est tracé (réussite, échec, retour arrière)', () => {
    expect(script).toContain('historique.log');
    expect(read('.gitignore')).toContain('.deploy/');
  });

  test('docker compose accepte une image publiée à la place de la construction locale', () => {
    const run = (image) => JSON.parse(execSync('docker compose config --format json', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, SINISTREFLOW_IMAGE: image },
    })).services;
    const image = 'ghcr.io/nchliyah-maker/sinistreflow-equipe1:abc123';

    expect(run(image).app.image).toBe(image);
    expect(run(image).migrate.image).toBe(image);
  });
});
