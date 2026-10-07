const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (file) => (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '');

describe('SF-601 : script de provisionnement de la VM', () => {
  const script = read('deploy/provision-vm.sh');

  test('le script s\'arrête à la première erreur', () => {
    expect(script).toMatch(/^set -euo pipefail$/m);
  });

  test('les fins de ligne sont celles de Linux (pas de CRLF)', () => {
    ['deploy/provision-vm.sh', 'deploy/install-host.sh', 'deploy/backup.sh', 'deploy/run-connector.sh']
      .forEach((file) => expect(read(file)).not.toContain('\r\n'));
  });

  test('SSH : clé uniquement, ni root ni mot de passe', () => {
    expect(script).toMatch(/^PermitRootLogin no$/m);
    expect(script).toMatch(/^PasswordAuthentication no$/m);
    expect(script).toMatch(/^PubkeyAuthentication yes$/m);
  });

  test('le réglage SSH passe avant ceux du système et son effet réel est vérifié', () => {
    expect(script).toContain('/etc/ssh/sshd_config.d/00-sinistreflow.conf');
    expect(script).toContain("grep -qx 'passwordauthentication no'");
    expect(script).toContain("grep -qx 'permitrootlogin no'");
  });

  test('garde-fou : la configuration SSH est vérifiée avant d\'être rechargée', () => {
    expect(script.indexOf('sshd -t')).toBeGreaterThan(-1);
    expect(script.indexOf('sshd -t')).toBeLessThan(script.indexOf('systemctl reload ssh'));
  });

  test('garde-fou : pas de durcissement SSH sans clé pour l\'utilisateur deploy', () => {
    const check = script.indexOf('aucune clé SSH pour');

    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(script.indexOf('PasswordAuthentication no'));
  });

  test('pare-feu : tout est refusé en entrée, sauf 22, 80 et 443', () => {
    expect(script).toMatch(/^ufw default deny incoming$/m);
    const allowed = [...script.matchAll(/^ufw allow (\d+)\/tcp/gm)].map((m) => m[1]);

    expect(allowed).toEqual(['22', '80', '443']);
    expect(script).toMatch(/^ufw --force enable$/m);
  });

  test('fail2ban et les mises à jour de sécurité automatiques sont activés', () => {
    expect(script).toContain('systemctl enable --now fail2ban');
    expect(script).toContain('APT::Periodic::Unattended-Upgrade "1";');
  });

  test('Docker vient du dépôt officiel, et deploy est dans le groupe docker', () => {
    expect(script).toContain('https://download.docker.com/linux/ubuntu');
    expect(script).toContain('docker-compose-plugin');
    expect(script).toMatch(/usermod -aG docker "\$DEPLOY_USER"/);
  });
});

describe('SF-601 : reverse proxy nginx', () => {
  const conf = read('deploy/nginx/sinistreflow.conf');

  test('/metrics est bloqué depuis l\'extérieur', () => {
    expect(conf).toMatch(/location = \/metrics \{\s*return 403;\s*\}/);
  });

  test('l\'application et Grafana sont relayés vers 127.0.0.1', () => {
    expect(conf).toMatch(/location \/ \{\s*proxy_pass http:\/\/127\.0\.0\.1:3000;/);
    expect(conf).toMatch(/location \/grafana\/ \{\s*proxy_pass http:\/\/127\.0\.0\.1:3001;/);
  });

  test('Prometheus et Alertmanager ne sont pas relayés', () => {
    expect(conf).not.toContain('9090');
    expect(conf).not.toContain('9093');
  });
});

describe('SF-601 : tâches planifiées', () => {
  test('sauvegarde quotidienne et connecteur horaire, sous l\'utilisateur deploy', () => {
    const install = read('deploy/install-host.sh');

    expect(install).toMatch(/^30 2 \* \* \* \$\{DEPLOY_USER\} bash .*backup\.sh/m);
    expect(install).toMatch(/^0 \* \* \* \* \$\{DEPLOY_USER\} bash .*run-connector\.sh/m);
  });

  test('la clé du connecteur est lue dans .env, jamais écrite dans un script', () => {
    const scripts = ['deploy/run-connector.sh', 'deploy/install-host.sh', 'deploy/provision-vm.sh'].map(read).join('\n');

    expect(read('deploy/run-connector.sh')).toContain("grep -E '^EXPERTAUTO_API_KEY=' .env");
    expect(scripts).not.toMatch(/ea_live_[0-9a-f]+/);
  });
});
