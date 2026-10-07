const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (file) => (fs.existsSync(path.join(ROOT, file)) ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '');

/** Lignes utiles d'un fichier : sans commentaires ni lignes vides. */
const lines = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

describe('SF-205 : image Docker de production légère et sans root', () => {
  const dockerfile = lines(read('Dockerfile'));
  const ignored = lines(read('.dockerignore'));

  test('l\'image part d\'une base légère (alpine ou slim)', () => {
    const from = dockerfile.filter((l) => l.startsWith('FROM '));

    expect(from.length).toBeGreaterThan(0);
    from.forEach((l) => expect(l).toMatch(/^FROM node:22-(alpine|slim)/));
  });

  test('seules les dépendances de production sont installées', () => {
    expect(dockerfile.some((l) => /npm ci\b.*--omit=dev/.test(l))).toBe(true);
    expect(dockerfile.some((l) => /npm install\b/.test(l))).toBe(false);
  });

  test('le projet n\'est pas copié en entier dans l\'image', () => {
    expect(dockerfile.some((l) => /^COPY\s+(--\S+\s+)*\.\s+\.$/.test(l))).toBe(false);
  });

  test('le processus ne tourne pas en root', () => {
    const user = dockerfile.filter((l) => l.startsWith('USER '));
    const lastUser = user[user.length - 1];

    expect(lastUser).toBeDefined();
    expect(lastUser).not.toMatch(/^USER\s+(root|0)\b/);
    expect(dockerfile.indexOf(lastUser)).toBeLessThan(dockerfile.findIndex((l) => l.startsWith('CMD ')));
  });

  test.each(['.env', '.git', 'node_modules', 'tests', 'db', 'docs', 'partner-client'])(
    '.dockerignore écarte %s du contexte de construction',
    (entry) => {
      expect(ignored).toContain(entry);
    },
  );
});
