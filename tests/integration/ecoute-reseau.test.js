const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

/** Adresse IPv4 de la machine sur le réseau (pas 127.0.0.1) : c'est par elle qu'arrive Docker. */
function externalIPv4() {
  const addresses = Object.values(os.networkInterfaces()).flat();
  const found = addresses.find((a) => a.family === 'IPv4' && !a.internal);
  return found ? found.address : null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function get(host, port) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host, port, path: '/', timeout: 3000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

describe('SF-201 : l\'application écoute sur toutes les interfaces réseau', () => {
  let child;
  let port;

  beforeAll(async () => {
    port = await freePort();
    child = spawn(process.execPath, ['src/index.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port), HOST: '' },
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('application non démarrée')), 10000);
      child.stdout.on('data', (data) => {
        if (String(data).includes('SinistreFlow démarré')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.on('exit', (code) => reject(new Error(`application arrêtée (code ${code})`)));
    });
  }, 15000);

  afterAll(() => {
    if (child) child.kill();
  });

  test('elle répond sur l\'adresse réseau de la machine, pas seulement sur localhost', async () => {
    const address = externalIPv4();
    expect(address).not.toBeNull();

    await expect(get(address, port)).resolves.toBe(200);
  });

  test('elle répond toujours sur 127.0.0.1', async () => {
    await expect(get('127.0.0.1', port)).resolves.toBe(200);
  });
});
